import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ImageUploadField from '../../components/admin/ImageUploadField.jsx';
import AdminConfirmationDialog from '../../components/admin/AdminConfirmationDialog.jsx';
import AboutPageEditor from './AboutPageEditor.jsx';
import {
  createAdminContent,
  deleteAdminContent,
  deleteAdminImage,
  getAdminContent,
  getCompanyProfile,
  listAdminContent,
  updateAdminContent,
  updateCompanyProfile,
  updateContactMessageStatus,
  uploadAdminImage,
} from '../../services/adminContentApi.js';
import { contentResources } from './contentResources.js';
import styles from './AdminContentPage.module.css';

const pageSize = 10;

function getErrorMessage(error) {
  if (error.status === 401) return 'Your admin session expired. Please sign in again.';
  if (error.status === 403) return 'You do not have permission to manage this content.';
  return error.message || 'The request could not be completed.';
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value))) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function cleanupImages(urls) {
  const imageUrls = [...new Set(urls.filter((url) => typeof url === 'string' && url.startsWith('/uploads/images/')))];
  const results = await Promise.allSettled(imageUrls.map((url) => deleteAdminImage(url)));
  const failures = results.filter((result) => result.status === 'rejected');
  for (const failure of failures) console.error('Managed image cleanup failed.', failure.reason);
  return failures.length;
}

export default function AdminContentPage({ resource: requestedResource }) {
  const { resource: routeResource } = useParams();
  const resource = requestedResource ?? routeResource;
  const definition = contentResources[resource];
  const isCompanyProfile = resource === 'company-profile';

  if (isCompanyProfile) return <CompanyProfileEditor />;
  if (resource === 'about-page') return <AboutPageEditor />;
  if (!definition) {
    return (
      <section className={styles.page}>
        <h1>Content section not found</h1>
        <Link to="/admin/dashboard">Return to dashboard</Link>
      </section>
    );
  }

  return <ResourceManager key={resource} resource={resource} definition={definition} />;
}

function ResourceManager({ resource, definition }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pageCount: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [selected, setSelected] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [relationOptions, setRelationOptions] = useState({});
  const [imageFiles, setImageFiles] = useState({});
  const [imageProgress, setImageProgress] = useState({});
  const isAutomaticStatistic = (field) => resource === 'site-statistics'
    && field.name === 'value'
    && ['projects-delivered', 'academic-courses'].includes(selected?.key);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await listAdminContent(resource, {
        page,
        pageSize,
        search,
        ...(filterName && filterValue ? { [filterName]: filterValue } : {}),
      });
      setItems(response.items ?? []);
      setPagination(response.pagination ?? { page, total: 0, pageCount: 1 });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [resource, page, search, filterName, filterValue]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 250);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  useEffect(() => {
    let active = true;
    const relations = [...new Set(definition.fields
      .map((field) => field.relation?.resource)
      .filter(Boolean))];
    Promise.all(relations.map(async (relation) => {
      const response = await listAdminContent(relation, { page: 1, pageSize: 100 });
      return [relation, response.items ?? []];
    })).then((entries) => {
      if (active) setRelationOptions(Object.fromEntries(entries));
    }).catch((requestError) => {
      if (active) setError(getErrorMessage(requestError));
    });
    return () => { active = false; };
  }, [definition]);

  function startCreate() {
    const initial = Object.fromEntries(definition.fields.map((field) => [
      field.name,
      field.defaultValue ?? (field.type === 'checkbox' ? false : ''),
    ]));
    setForm(initial);
    setImageFiles({});
    setImageProgress({});
    setSelected(null);
    setFormMode('create');
    setError('');
    setNotice('');
  }

  async function startEdit(item) {
    setError('');
    setNotice('');
    try {
      const response = await getAdminContent(resource, item.id);
      setSelected(response.item);
      setForm(Object.fromEntries(definition.fields.map((field) => [
        field.name,
        response.item[field.name] ?? field.defaultValue ?? (field.type === 'checkbox' ? false : ''),
      ])));
      setImageFiles({});
      setImageProgress({});
      setFormMode('edit');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function submitForm(event) {
    event.preventDefault();
    if (saving || (definition.readOnly && resource !== 'contact-messages')) return;

    const body = {};
    for (const field of definition.fields) {
    if (field.readOnly || isAutomaticStatistic(field)) continue;
      const value = form[field.name];
      body[field.name] = field.type === 'number'
        ? (value === '' ? null : Number(value))
        : field.type === 'checkbox'
          ? Boolean(value)
          : value === '' && !field.required
            ? null
            : value;
    }

    setSaving(true);
    setError('');
    setNotice('');
    let uploadedImageUrls = [];
    let cmsSaved = false;
    try {
      for (const field of definition.fields.filter((item) => item.type === 'image' && imageFiles[item.name])) {
        const image = await uploadAdminImage(resource, imageFiles[field.name], (progress) => {
          setImageProgress((current) => ({ ...current, [field.name]: progress }));
        });
        uploadedImageUrls.push(image.url);
        body[field.name] = image.url;
      }

      if (resource === 'contact-messages') {
        await updateContactMessageStatus(selected.id, body.status);
        window.dispatchEvent(new Event('admin-contact-messages-updated'));
      } else if (formMode === 'create') {
        await createAdminContent(resource, body);
      } else {
        await updateAdminContent(resource, selected.id, body);
      }
      cmsSaved = true;

      const previousImages = definition.fields
        .filter((field) => field.type === 'image')
        .map((field) => selected?.[field.name])
        .filter(Boolean);
      const nextImages = definition.fields
        .filter((field) => field.type === 'image')
        .map((field) => body[field.name]);
      const cleanupFailures = await cleanupImages(previousImages.filter((url) => !nextImages.includes(url)));

      setFormMode(null);
      setSelected(null);
      setImageFiles({});
      setImageProgress({});
      setNotice(`${definition.singular} saved successfully.${cleanupFailures ? ' The previous image could not be removed; contact an administrator to retry cleanup.' : ''}`);
      await loadItems();
    } catch (requestError) {
      const cleanupFailures = cmsSaved ? 0 : await cleanupImages(uploadedImageUrls);
      setError(`${getErrorMessage(requestError)}${cleanupFailures ? ' An uploaded image could not be removed; contact an administrator to retry cleanup.' : ''}`);
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemoveItem() {
    if (!pendingDelete || deleting || definition.readOnly) return;
    const item = pendingDelete;
    setDeleting(true);
    setError('');
    setNotice('');
    try {
      await deleteAdminContent(resource, item.id);
      const imageUrls = definition.fields
        .filter((field) => field.type === 'image')
        .map((field) => item[field.name])
        .filter(Boolean);
      const cleanupFailures = await cleanupImages(imageUrls);
      setNotice(`${definition.singular} deleted.${cleanupFailures ? ' Its image could not be removed; contact an administrator to retry cleanup.' : ''}`);
      if (selected?.id === item.id) setSelected(null);
      await loadItems();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingDelete(null);
      setDeleting(false);
    }
  }

  const filterFields = useMemo(() => definition.filterFields ?? [], [definition]);
  const selectedFilter = filterFields.find((field) => field.name === filterName);
  const filterOptions = selectedFilter?.relation
    ? (relationOptions[selectedFilter.relation.resource] ?? []).map((item) => ({
      value: item.id,
      label: item[selectedFilter.relation.label],
    }))
    : selectedFilter?.options ?? [];

  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Content management</p>
          <h1>{definition.title}</h1>
          <p>{resource === 'site-statistics'
            ? 'Edit statistic headings, descriptions, order, and visibility. Project and course totals are automatic; only institution and student values are editable.'
            : 'Manage website content and publication state.'}</p>
        </div>
        {!definition.readOnly && definition.allowCreate !== false && (
          <button className={styles.primaryButton} type="button" onClick={startCreate}>
            Create {definition.singular}
          </button>
        )}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}

      {formMode && !definition.readOnly && (
        <form className={styles.formCard} onSubmit={submitForm}>
          <div className={styles.formHeading}>
            <h2>{formMode === 'create' ? `Create ${definition.singular}` : `Edit ${definition.singular}`}</h2>
            <button type="button" className={styles.textButton} onClick={() => {
              setFormMode(null);
              setImageFiles({});
              setImageProgress({});
            }}>Cancel</button>
          </div>
          <div className={styles.fields}>
            {definition.fields.filter((field) => !field.readOnly && !isAutomaticStatistic(field)).map((field) => (
              <FormField
                key={field.name}
                field={resource === 'team-members' && field.name === 'photoUrl'
                  ? { ...field, previewObjectPosition: `center ${form.photoPosition ?? 35}%` }
                  : field}
                value={form[field.name]}
                options={field.relation
                  ? (relationOptions[field.relation.resource] ?? []).map((item) => ({
                    value: item.id,
                    label: item[field.relation.label],
                  }))
                  : undefined}
                file={imageFiles[field.name]}
                uploadProgress={imageProgress[field.name]}
                onFileChange={(file) => setImageFiles((current) => ({ ...current, [field.name]: file }))}
                onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
              />
            ))}
          </div>
          <button className={styles.primaryButton} disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      <div className={styles.toolbar}>
        <label>
          <span className={styles.srOnly}>Search {definition.title}</span>
          <input
            type="search"
            placeholder={`Search ${definition.title.toLowerCase()}…`}
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
        </label>
        {filterFields.length > 0 && (
          <>
            <label>
              <span className={styles.srOnly}>Filter field</span>
              <select value={filterName} onChange={(event) => {
                setPage(1);
                setFilterName(event.target.value);
                setFilterValue('');
              }}>
                <option value="">Filter by…</option>
                {filterFields.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
              </select>
            </label>
            {selectedFilter && (
              <label>
                <span className={styles.srOnly}>{selectedFilter.label}</span>
                <select value={filterValue} onChange={(event) => {
                  setPage(1);
                  setFilterValue(event.target.value);
                }}>
                  <option value="">All</option>
                  {filterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
      </div>

      <div
        className={styles.tableWrap}
        aria-label={`${definition.title} results`}
        aria-busy={loading}
        tabIndex={0}
      >
        {loading ? (
          <p className={styles.state} role="status">Loading {definition.title.toLowerCase()}…</p>
        ) : items.length === 0 ? (
          <p className={styles.state}>No {definition.title.toLowerCase()} found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                {definition.columns.map((column) => <th key={column}>{column.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</th>)}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {definition.columns.map((column) => <td key={column}>{formatCell(item[column])}</td>)}
                  <td className={styles.actions}>
                    <button className={styles.textButton} type="button" onClick={() => startEdit(item)}>
                      {definition.readOnly ? 'View / update' : 'Edit'}
                    </button>
                    {!definition.readOnly && definition.allowDelete !== false && (
                      <button className={styles.dangerButton} type="button" onClick={() => setPendingDelete(item)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formMode && selected && definition.readOnly && (
        <form className={styles.formCard} onSubmit={submitForm}>
          <h2>Message details</h2>
          <dl className={styles.messageDetails}>
            {definition.fields.filter((field) => field.name !== 'status').map((field) => (
              <div key={field.name}>
                <dt>{field.label}</dt>
                <dd>{formatCell(selected[field.name])}</dd>
              </div>
            ))}
          </dl>
          <label className={styles.field} htmlFor="contact-status">Status</label>
          <select
            id="contact-status"
            value={form.status ?? selected.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            {definition.statusOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button className={styles.primaryButton} type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Update status'}
          </button>
        </form>
      )}

      {!loading && pagination.pageCount > 1 && (
        <nav className={styles.pagination} aria-label="Pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
          <span>Page {pagination.page ?? page} of {pagination.pageCount}</span>
          <button type="button" disabled={page >= pagination.pageCount} onClick={() => setPage((current) => current + 1)}>Next</button>
        </nav>
      )}
      <AdminConfirmationDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${definition.singular.toLowerCase()}?`}
        message={`Delete this ${definition.singular.toLowerCase()}? This action cannot be undone.`}
        busy={deleting}
        onConfirm={() => void confirmRemoveItem()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}

function FormField({ field, value, onChange, options, file, onFileChange, uploadProgress }) {
  const id = `content-${field.name}`;
  if (field.type === 'image') {
    return (
      <ImageUploadField
        field={field}
        value={value}
        file={file}
        onChange={onChange}
        onFileChange={onFileChange}
        uploadProgress={uploadProgress}
      />
    );
  }
  if (field.type === 'checkbox') {
    return (
      <label className={styles.checkboxField} htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
      </label>
    );
  }

  return (
    <label className={styles.field} htmlFor={id}>
      {field.label}
      {field.type === 'textarea' ? (
        <textarea
          id={id}
          required={field.required}
          maxLength={field.maxLength}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          rows={field.name === 'body' || field.name === 'description' ? 8 : 4}
        />
      ) : field.type === 'select' || field.relation ? (
        <select id={id} required={field.required} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select…</option>
          {(options ?? field.options).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input
          id={id}
          type={field.type ?? 'text'}
          required={field.required}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function CompanyProfileEditor() {
  const [profile, setProfile] = useState(null);
  const [socialLinks, setSocialLinks] = useState([]);
  const [socialForm, setSocialForm] = useState(null);
  const [pendingSocialDelete, setPendingSocialDelete] = useState(null);
  const [deletingSocialLink, setDeletingSocialLink] = useState(false);
  const [socialSaving, setSocialSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoProgress, setLogoProgress] = useState(null);
  const [homeIntroImageFile, setHomeIntroImageFile] = useState(null);
  const [homeIntroImageProgress, setHomeIntroImageProgress] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getCompanyProfile(),
      listAdminContent('company-profile/social-links', { page: 1, pageSize: 100 }),
    ]).then(([profileResponse, socialResponse]) => {
      if (active) {
        setProfile(profileResponse.item ?? {});
        setSocialLinks(socialResponse.items ?? []);
      }
    }).catch((requestError) => {
      if (active) setError(getErrorMessage(requestError));
    })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const uploadedImageUrls = [];
    let saved = false;
    try {
      const body = Object.fromEntries(Object.entries(profile).filter(([key]) => [
        'name', 'tagline', 'description', 'email', 'phone', 'location', 'hours', 'logoUrl', 'homeIntroImageUrl',
      ].includes(key)));
      if (logoFile) {
        const image = await uploadAdminImage('company-profile', logoFile, setLogoProgress);
        uploadedImageUrls.push(image.url);
        body.logoUrl = image.url;
      }
      if (homeIntroImageFile) {
        const image = await uploadAdminImage('company-profile', homeIntroImageFile, setHomeIntroImageProgress);
        uploadedImageUrls.push(image.url);
        body.homeIntroImageUrl = image.url;
      }
      const response = await updateCompanyProfile(body);
      saved = true;
      setProfile(response.item);
      setLogoFile(null);
      setLogoProgress(null);
      setHomeIntroImageFile(null);
      setHomeIntroImageProgress(null);
      const previousImages = [profile.logoUrl, profile.homeIntroImageUrl]
        .filter((url) => url && !Object.values(body).includes(url));
      const cleanupFailures = await cleanupImages(previousImages);
      setNotice(`Company profile saved.${cleanupFailures ? ' A previous image could not be removed; contact an administrator to retry cleanup.' : ''}`);
    } catch (requestError) {
      const cleanupFailures = saved ? 0 : await cleanupImages(uploadedImageUrls);
      setError(`${getErrorMessage(requestError)}${cleanupFailures ? ' An uploaded image could not be removed; contact an administrator to retry cleanup.' : ''}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveSocialLink(event) {
    event.preventDefault();
    if (socialSaving) return;
    setSocialSaving(true);
    setError('');
    setNotice('');
    try {
      const body = {
        platform: socialForm.platform,
        url: socialForm.url,
        sortOrder: Number(socialForm.sortOrder || 0),
        isActive: Boolean(socialForm.isActive),
      };
      if (socialForm.id) {
        await updateAdminContent('company-profile/social-links', socialForm.id, body);
      } else {
        await createAdminContent('company-profile/social-links', body);
      }
      const response = await listAdminContent('company-profile/social-links', { page: 1, pageSize: 100 });
      setSocialLinks(response.items ?? []);
      setSocialForm(null);
      setNotice('Social link saved.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSocialSaving(false);
    }
  }

  async function removeSocialLink() {
    if (!pendingSocialDelete || deletingSocialLink) return;
    const item = pendingSocialDelete;
    setDeletingSocialLink(true);
    setError('');
    setNotice('');
    try {
      await deleteAdminContent('company-profile/social-links', item.id);
      setSocialLinks((current) => current.filter((link) => link.id !== item.id));
      setNotice('Social link deleted.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingSocialDelete(null);
      setDeletingSocialLink(false);
    }
  }

  if (loading) return <p role="status">Loading company profile…</p>;

  const fields = [
    { name: 'name', label: 'Company name', required: true, maxLength: 120 },
    { name: 'tagline', label: 'Tagline', maxLength: 180 },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'email', label: 'Email', type: 'email', maxLength: 320 },
    { name: 'phone', label: 'Phone', maxLength: 32 },
    { name: 'location', label: 'Address / location', maxLength: 160 },
    { name: 'hours', label: 'Business hours', maxLength: 160 },
    { name: 'logoUrl', label: 'Company logo', type: 'image', resource: 'company-profile' },
    { name: 'homeIntroImageUrl', label: 'Home intro image', type: 'image', resource: 'company-profile' },
  ];

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Content management</p>
      <h1>Company Profile</h1>
      <p className={styles.intro}>Edit the singleton company profile and public contact details.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      <form className={styles.formCard} onSubmit={submit}>
        <div className={styles.fields}>
          {fields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={field.name === 'homeIntroImageUrl'
                ? profile?.homeIntroImageUrl || '/images/image1.jpg'
                : profile?.[field.name] ?? ''}
              file={field.name === 'homeIntroImageUrl' ? homeIntroImageFile : field.name === 'logoUrl' ? logoFile : undefined}
              uploadProgress={field.name === 'homeIntroImageUrl'
                ? homeIntroImageProgress
                : field.name === 'logoUrl' ? logoProgress : undefined}
              onFileChange={field.name === 'homeIntroImageUrl'
                ? setHomeIntroImageFile
                : field.name === 'logoUrl' ? setLogoFile : undefined}
              onChange={(value) => setProfile((current) => ({ ...current, [field.name]: value }))}
            />
          ))}
        </div>
        <button className={styles.primaryButton} type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <section className={styles.formCard} aria-labelledby="social-links-title">
        <div className={styles.formHeading}>
          <h2 id="social-links-title">Social links</h2>
          {!socialForm && (
            <button
              className={styles.textButton}
              type="button"
              onClick={() => setSocialForm({ platform: '', url: '', sortOrder: 0, isActive: true })}
            >
              Add social link
            </button>
          )}
        </div>
        {socialLinks.length === 0
          ? <p className={styles.state}>No social links added.</p>
          : (
            <ul className={styles.socialList}>
              {socialLinks.map((item) => (
                <li key={item.id}>
                  <span><strong>{item.platform}</strong> — {item.url} {!item.isActive && '(inactive)'}</span>
                  <span className={styles.actions}>
                    <button className={styles.textButton} type="button" onClick={() => setSocialForm(item)}>Edit</button>
                    <button className={styles.dangerButton} type="button" onClick={() => setPendingSocialDelete(item)}>Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        {socialForm && (
          <form className={styles.fields} onSubmit={saveSocialLink}>
            <label className={styles.field} htmlFor="social-platform">
              Platform
              <input
                id="social-platform"
                required
                maxLength={30}
                value={socialForm.platform}
                onChange={(event) => setSocialForm({ ...socialForm, platform: event.target.value })}
              />
            </label>
            <label className={styles.field} htmlFor="social-url">
              URL
              <input
                id="social-url"
                type="url"
                required
                maxLength={2048}
                value={socialForm.url}
                onChange={(event) => setSocialForm({ ...socialForm, url: event.target.value })}
              />
            </label>
            <label className={styles.field} htmlFor="social-order">
              Sort order
              <input
                id="social-order"
                type="number"
                min="0"
                value={socialForm.sortOrder}
                onChange={(event) => setSocialForm({ ...socialForm, sortOrder: event.target.value })}
              />
            </label>
            <label className={styles.checkboxField} htmlFor="social-active">
              <input
                id="social-active"
                type="checkbox"
                checked={Boolean(socialForm.isActive)}
                onChange={(event) => setSocialForm({ ...socialForm, isActive: event.target.checked })}
              />
              Active
            </label>
            <div className={styles.actions}>
              <button className={styles.primaryButton} type="submit" disabled={socialSaving}>
                {socialSaving ? 'Saving…' : 'Save social link'}
              </button>
              <button className={styles.textButton} type="button" onClick={() => setSocialForm(null)}>Cancel</button>
            </div>
          </form>
        )}
      </section>
      <AdminConfirmationDialog
        open={Boolean(pendingSocialDelete)}
        title="Delete social link?"
        message={`Delete the ${pendingSocialDelete?.platform ?? ''} social link? This action cannot be undone.`}
        busy={deletingSocialLink}
        onConfirm={() => void removeSocialLink()}
        onCancel={() => setPendingSocialDelete(null)}
      />
    </section>
  );
}
