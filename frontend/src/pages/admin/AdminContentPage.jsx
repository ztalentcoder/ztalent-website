import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import ImageUploadField, { MAX_IMAGE_FILE_SIZE, SUPPORTED_IMAGE_TYPES } from '../../components/admin/ImageUploadField.jsx';
import AdminConfirmationDialog from '../../components/admin/AdminConfirmationDialog.jsx';
import MarkdownArticleEditor from '../../components/admin/MarkdownArticleEditor.jsx';
import ServiceIcon from '../../components/common/ServiceIcon.jsx';
import MarkdownArticleContent from '../../components/common/MarkdownArticleContent.jsx';
import useAutoDismissNotice from '../../hooks/useAutoDismissNotice.js';
import AcademicCourseManager from './AcademicCourseManager.jsx';
import AboutPageEditor from './AboutPageEditor.jsx';
import { DEFAULT_COMPANY_CONTACT, DEFAULT_SOCIAL_PLATFORMS } from '../../constants/companyProfile.js';
import {
  createAdminContent,
  deleteAdminContent,
  deleteAdminImage,
  getAdminContent,
  getCompanyProfile,
  listAdminContent,
  patchAdminContent,
  patchCompanyProfile,
  updateAdminContent,
  updateContactMessageStatus,
  uploadAdminImage,
} from '../../services/adminContentApi.js';
import { contentResources } from './contentResources.js';
import styles from './AdminContentPage.module.css';
import companyStyles from './CompanyProfileEditor.module.css';
import { getPublicImageUrl } from '../../services/publicContentApi.js';

const pageSize = 10;
const PROJECT_FORM_SECTIONS = ['Basic Information', 'Project Details', 'Project Gallery'];
const MAX_PROJECT_GALLERY_IMAGES = 20;
const EMPTY_PROJECT_ITEMS = Object.freeze([]);
const COMPANY_HERO_IMAGE_FIELDS = ['homeHeroImage1Url', 'homeHeroImage2Url', 'homeHeroImage3Url'];
const COMPANY_PROFILE_IMAGE_FIELDS = ['logoUrl', 'homeIntroImageUrl', ...COMPANY_HERO_IMAGE_FIELDS];
let nextProjectEditorId = 0;

function getErrorMessage(error) {
  if (error.status === 401) return 'Your admin session expired. Please sign in again.';
  if (error.status === 403) return 'You do not have permission to manage this content.';
  return error.message || 'The request could not be completed.';
}

function withCompanyProfileDefaults(profile) {
  return {
    ...DEFAULT_COMPANY_CONTACT,
    ...profile,
    name: profile?.name || 'Ztalent Coder',
    email: profile?.email || DEFAULT_COMPANY_CONTACT.email,
    phone: profile?.phone || DEFAULT_COMPANY_CONTACT.phone,
    location: profile?.location || DEFAULT_COMPANY_CONTACT.location,
  };
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value))) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getNestedValue(item, path) {
  return path.split('.').reduce((value, part) => value?.[part], item);
}

function getRelationLabel(item, relation) {
  const label = item[relation.label];
  const secondary = relation.secondaryLabel && getNestedValue(item, relation.secondaryLabel);
  return secondary ? `${label} (${secondary})` : label;
}

async function cleanupImages(urls) {
  const imageUrls = [...new Set(urls.filter((url) => typeof url === 'string' && url.startsWith('/uploads/images/')))];
  const results = await Promise.allSettled(imageUrls.map((url) => deleteAdminImage(url)));
  const failures = results.filter((result) => result.status === 'rejected');
  for (const failure of failures) console.error('Managed image cleanup failed.', failure.reason);
  return failures.length;
}

function getFieldImageUrls(fields, item) {
  const fieldUrls = fields.flatMap((field) => {
    const value = item?.[field.name];
    if (field.type === 'image') return typeof value === 'string' ? [value] : [];
    if (field.type === 'projectGallery' && Array.isArray(value)) {
      return value.map((image) => (typeof image === 'string' ? image : image?.imageUrl)).filter(Boolean);
    }
    return [];
  });
  const markdownUrls = typeof item?.body === 'string'
    ? [...item.body.matchAll(/!\[[^\]]*\]\((\/uploads\/images\/blog\/[^)\s]+)\)/g)].map((match) => match[1])
    : [];
  return [...fieldUrls, ...markdownUrls];
}

function slugifyTitle(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminContentPage({
  resource: requestedResource,
  scopedBusinessArea,
  techSolutionsMode = false,
}) {
  const { resource: routeResource } = useParams();
  const resource = requestedResource ?? routeResource;
  const definition = contentResources[resource];
  const isCompanyProfile = resource === 'company-profile';

  if (isCompanyProfile) return <CompanyProfileEditor />;
  if (resource === 'about-page') return <AboutPageEditor />;
  if (resource === 'academic-courses') return <AcademicCourseManager />;
  if (!definition) {
    return (
      <section className={styles.page}>
        <h1>Content section not found</h1>
        <Link to="/admin/dashboard">Return to dashboard</Link>
      </section>
    );
  }

  return (
    <ResourceManager
      key={`${resource}-${scopedBusinessArea?.id ?? 'all'}`}
      resource={resource}
      definition={definition}
      scopedBusinessArea={scopedBusinessArea}
      techSolutionsMode={techSolutionsMode}
    />
  );
}

function ResourceManager({ resource, definition, scopedBusinessArea, techSolutionsMode }) {
  const serviceManagementMode = resource === 'services' && Boolean(scopedBusinessArea);
  const resourceTitle = serviceManagementMode ? `${scopedBusinessArea.name} Services` : definition.title;
  const isBusinessAreaScopedResource = scopedBusinessArea
    && ['services', 'service-categories'].includes(resource);
  const scopeQuery = isBusinessAreaScopedResource
    ? { businessAreaId: scopedBusinessArea.id }
    : undefined;
  const [formMode, setFormMode] = useState(null);
  const visibleFields = useMemo(() => definition.fields
    .filter((field) => !(
      (isBusinessAreaScopedResource && field.name === 'businessAreaId')
      || (serviceManagementMode && ['serviceCategoryId', 'description', 'keyFeatures'].includes(field.name))
    ))
    .map((field) => serviceManagementMode && field.name === 'title'
      ? { ...field, label: 'Service Name' }
      : serviceManagementMode && field.name === 'summary'
        ? { ...field, label: 'Short Description' }
        : field), [definition, isBusinessAreaScopedResource, serviceManagementMode]);
  const createFields = useMemo(() => visibleFields.filter((field) => !(
    resource === 'projects' && field.name === 'businessAreaId'
  )), [resource, visibleFields]);
  const formFields = formMode === 'create' ? createFields : visibleFields;
  const visibleFilters = useMemo(() => (definition.filterFields ?? []).filter((field) => !(
    (isBusinessAreaScopedResource && field.name === 'businessAreaId')
    || (serviceManagementMode && field.name === 'serviceCategoryId')
  )), [definition, isBusinessAreaScopedResource, serviceManagementMode]);
  const visibleColumns = useMemo(() => definition.columns.filter((column) => !(
    (isBusinessAreaScopedResource && column === 'businessArea.name')
    || (serviceManagementMode && column === 'serviceCategory.name')
  )), [definition, isBusinessAreaScopedResource, serviceManagementMode]);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pageCount: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [selected, setSelected] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({});
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [uploadedMarkdownImages, setUploadedMarkdownImages] = useState([]);
  const [showBlogPreview, setShowBlogPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useAutoDismissNotice();
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
        ...(isBusinessAreaScopedResource ? { businessAreaId: scopedBusinessArea.id } : {}),
        ...(filterName && filterValue ? { [filterName]: filterValue } : {}),
      });
      setItems(response.items ?? []);
      setPagination(response.pagination ?? { page, total: 0, pageCount: 1 });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [resource, page, search, filterName, filterValue, isBusinessAreaScopedResource, scopedBusinessArea?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 250);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  useEffect(() => {
    let active = true;
    const relations = [...new Set(visibleFields
      .map((field) => field.relation?.resource)
      .filter(Boolean))];
    Promise.all(relations.map(async (relation) => {
      const response = await listAdminContent(relation, {
        page: 1,
        pageSize: 100,
        ...(isBusinessAreaScopedResource && relation === 'service-categories'
          ? { businessAreaId: scopedBusinessArea.id }
          : {}),
      });
      return [relation, response.items ?? []];
    })).then((entries) => {
      if (active) setRelationOptions(Object.fromEntries(entries));
    }).catch((requestError) => {
      if (active) setError(getErrorMessage(requestError));
    });
    return () => { active = false; };
  }, [definition, visibleFields, isBusinessAreaScopedResource, scopedBusinessArea?.id]);

  function startCreate() {
    const initial = Object.fromEntries(createFields.map((field) => [
      field.name,
      field.defaultValue ?? (field.type === 'checkbox' || field.type === 'hidden' ? false : ''),
    ]));
    if (isBusinessAreaScopedResource) initial.businessAreaId = scopedBusinessArea.id;
    setForm(initial);
    setImageFiles({});
    setImageProgress({});
    setUploadedMarkdownImages([]);
    setSlugManuallyEdited(false);
    setShowBlogPreview(false);
    setSelected(null);
    setFormMode('create');
    setError('');
    setNotice('');
  }

  async function startEdit(item) {
    setError('');
    setNotice('');
    try {
      const response = await getAdminContent(resource, item.id, ...(scopeQuery ? [scopeQuery] : []));
      setSelected(response.item);
      setForm(Object.fromEntries(visibleFields.map((field) => [
        field.name,
        field.type === 'stringArray' && Array.isArray(response.item[field.name])
          ? response.item[field.name].join('\n')
          : field.type === 'projectFeatures' && Array.isArray(response.item[field.name])
            ? response.item[field.name].map((feature, index) => ({
              id: feature.id ?? `feature-${index}`,
              title: feature.title,
              description: feature.description,
            }))
            : field.type === 'projectGallery' && Array.isArray(response.item[field.name])
              ? response.item[field.name].map((image, index) => ({
                id: image.id ?? `image-${index}`,
                url: image.imageUrl,
              }))
          : response.item[field.name] ?? field.defaultValue ?? (field.type === 'checkbox' || field.type === 'hidden' ? false : ''),
      ])));
      setImageFiles({});
      setImageProgress({});
      setUploadedMarkdownImages([]);
      setSlugManuallyEdited(true);
      setShowBlogPreview(false);
      setFormMode('edit');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function submitForm(event) {
    event.preventDefault();
    if (saving || (definition.readOnly && resource !== 'contact-messages')) return;
    if (resource === 'blog-posts' && !String(form.body ?? '').trim()) {
      setError('Article content is required.');
      return;
    }

    const body = {};
    for (const field of formFields) {
      if (field.readOnly || isAutomaticStatistic(field)) continue;
      const value = form[field.name];
      if (resource === 'blog-posts' && field.name === 'slug' && !String(value ?? '').trim()) continue;
      if (field.type === 'projectFeatures') {
        body[field.name] = (Array.isArray(value) ? value : [])
          .map(({ title, description }) => ({ title, description }));
        continue;
      }
      if (field.type === 'projectGallery') {
        body[field.name] = [];
        continue;
      }
      body[field.name] = field.type === 'number'
        ? (value === '' ? null : Number(value))
        : field.type === 'checkbox'
          ? Boolean(value)
          : field.type === 'stringArray'
            ? (Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean))
            : value === '' && !field.required
              ? null
              : value;
    }
    if (isBusinessAreaScopedResource) body.businessAreaId = scopedBusinessArea.id;
    if (techSolutionsMode) body.serviceCategoryId = null;

    setSaving(true);
    setError('');
    setNotice('');
    let uploadedImageUrls = [...uploadedMarkdownImages];
    let cmsSaved = false;
    try {
      for (const field of definition.fields.filter((item) => item.type === 'image' && imageFiles[item.name])) {
        const image = await uploadAdminImage(resource, imageFiles[field.name], (progress) => {
          setImageProgress((current) => ({ ...current, [field.name]: progress }));
        });
        uploadedImageUrls.push(image.url);
        body[field.name] = image.url;
      }
      const galleryField = definition.fields.find((field) => field.type === 'projectGallery');
      if (galleryField) {
        const galleryImages = [];
        for (const galleryItem of form[galleryField.name] ?? []) {
          let imageUrl = galleryItem.url;
          if (galleryItem.file) {
            const image = await uploadAdminImage(resource, galleryItem.file, (progress) => {
              setImageProgress((current) => ({ ...current, [`${galleryField.name}-${galleryItem.id}`]: progress }));
            });
            uploadedImageUrls.push(image.url);
            imageUrl = image.url;
          }
          if (imageUrl) galleryImages.push({ imageUrl });
        }
        body[galleryField.name] = galleryImages;
      }

      if (resource === 'contact-messages') {
        await updateContactMessageStatus(selected.id, body.status);
        window.dispatchEvent(new Event('admin-contact-messages-updated'));
      } else if (formMode === 'create') {
        await createAdminContent(resource, body, ...(scopeQuery ? [scopeQuery] : []));
      } else {
        await updateAdminContent(resource, selected.id, body, ...(scopeQuery ? [scopeQuery] : []));
      }
      cmsSaved = true;

      const previousImages = getFieldImageUrls(definition.fields, selected);
      const nextImages = getFieldImageUrls(definition.fields, body);
      const cleanupFailures = await cleanupImages([
        ...previousImages.filter((url) => !nextImages.includes(url)),
        ...uploadedImageUrls.filter((url) => !nextImages.includes(url)),
      ]);

      setFormMode(null);
      setSelected(null);
      setImageFiles({});
      setImageProgress({});
      setUploadedMarkdownImages([]);
      setShowBlogPreview(false);
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
      await deleteAdminContent(resource, item.id, ...(scopeQuery ? [scopeQuery] : []));
      const imageUrls = getFieldImageUrls(definition.fields, item);
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

  const filterFields = useMemo(() => visibleFilters, [visibleFilters]);
  const selectedFilter = filterFields.find((field) => field.name === filterName);
  const filterOptions = selectedFilter?.relation
    ? (relationOptions[selectedFilter.relation.resource] ?? []).map((item) => ({
      value: item.id,
      label: getRelationLabel(item, selectedFilter.relation),
    }))
    : selectedFilter?.options ?? [];
  const formFieldsToRender = formFields.filter((field) => (
    field.type !== 'hidden' && !field.readOnly && !isAutomaticStatistic(field)
  ));

  function cancelForm() {
    if (uploadedMarkdownImages.length) void cleanupImages(uploadedMarkdownImages);
    setUploadedMarkdownImages([]);
    setShowBlogPreview(false);
    setFormMode(null);
    setImageFiles({});
    setImageProgress({});
  }

  function renderFormField(field) {
    return (
      <FormField
        key={field.name}
        field={resource === 'team-members' && field.name === 'photoUrl'
          ? { ...field, previewObjectPosition: `center ${form.photoPosition ?? 35}%` }
          : field}
        value={form[field.name]}
        options={field.relation
          ? (relationOptions[field.relation.resource] ?? [])
            .filter((item) => !field.dependsOn || (form[field.dependsOn] && item.businessAreaId === form[field.dependsOn]))
            .map((item) => ({
              value: item.id,
              label: getRelationLabel(item, field.relation),
            }))
          : undefined}
        disabled={Boolean(field.dependsOn && !form[field.dependsOn])}
        file={imageFiles[field.name]}
        uploadProgress={imageProgress[field.name]}
        imageProgress={imageProgress}
        onImageUploaded={(url) => setUploadedMarkdownImages((current) => [...current, url])}
        onFileChange={(file) => setImageFiles((current) => ({ ...current, [field.name]: file }))}
        onChange={(value) => setForm((current) => ({
          ...current,
          [field.name]: value,
          ...(resource === 'blog-posts' && formMode === 'create' && field.name === 'title' && !slugManuallyEdited
            ? { slug: slugifyTitle(value) }
            : {}),
          ...(field.name === 'businessAreaId' && ['services', 'service-categories'].includes(resource)
            ? { serviceCategoryId: '' }
            : {}),
        }))}
        onSlugManuallyEdited={() => setSlugManuallyEdited(true)}
      />
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Content management</p>
          <h1>{resourceTitle}</h1>
          <p>{resource === 'site-statistics'
            ? 'Edit statistic headings, descriptions, order, and visibility. Project and course totals are automatic; only institution and student values are editable.'
            : serviceManagementMode
              ? `Manage ${scopedBusinessArea.name} services, icons, descriptions, publication status, and display order.`
              : 'Manage website content and publication state.'}</p>
        </div>
        <div className={styles.actions}>
          {!definition.readOnly && definition.allowCreate !== false && (
            <button className={styles.primaryButton} type="button" onClick={startCreate}>
              Create {definition.singular}
            </button>
          )}
        </div>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}

      {formMode && !definition.readOnly && (
        <form className={styles.formCard} onSubmit={submitForm}>
          <div className={styles.formHeading}>
            <h2>{formMode === 'create' ? `Create ${definition.singular}` : `Edit ${definition.singular}`}</h2>
            <div className={styles.formHeadingActions}>
              {resource === 'blog-posts' && (
                <button
                  type="button"
                  className={styles.textButton}
                  aria-expanded={showBlogPreview}
                  onClick={() => setShowBlogPreview((visible) => !visible)}
                >{showBlogPreview ? 'Hide article preview' : 'Preview article'}</button>
              )}
              <button type="button" className={styles.textButton} onClick={cancelForm}>Cancel</button>
            </div>
          </div>
          {resource === 'projects'
            ? PROJECT_FORM_SECTIONS.map((section) => {
              const sectionFields = formFieldsToRender.filter((field) => field.section === section);
              const sectionId = `project-form-${section.toLowerCase().replace(/ /g, '-')}`;
              return sectionFields.length > 0 ? (
                <section className={styles.formSection} key={section} aria-labelledby={sectionId}>
                  <h3 id={sectionId}>{section}</h3>
                  <div className={styles.fields}>{sectionFields.map(renderFormField)}</div>
                </section>
              ) : null;
            })
            : <div className={styles.fields}>{formFieldsToRender.map(renderFormField)}</div>}
          {resource === 'blog-posts' && showBlogPreview && (
            <section className={styles.blogPreview} aria-label="Article preview">
              {form.coverImageUrl && (
                <img
                  src={getPublicImageUrl(form.coverImageUrl)}
                  alt={form.coverImageAlt || ''}
                  onError={(event) => { event.currentTarget.hidden = true; }}
                />
              )}
              {form.title && <h2>{form.title}</h2>}
              {form.excerpt && <p className={styles.blogPreviewExcerpt}>{form.excerpt}</p>}
              <p className={styles.blogPreviewMeta}>
                {[form.author, form.publishedAt && new Date(form.publishedAt).toLocaleDateString()].filter(Boolean).join(' · ')}
              </p>
              <MarkdownArticleContent markdown={form.body} />
            </section>
          )}
          <button className={styles.primaryButton} disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      <div className={styles.toolbar}>
        <label>
          <span className={styles.srOnly}>Search {resourceTitle}</span>
          <input
            type="search"
            placeholder={`Search ${resourceTitle.toLowerCase()}…`}
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
        aria-label={`${resourceTitle} results`}
        aria-busy={loading}
        tabIndex={0}
      >
        {loading ? (
          <p className={styles.state} role="status">Loading {resourceTitle.toLowerCase()}…</p>
        ) : items.length === 0 ? (
          <p className={styles.state}>No {resourceTitle.toLowerCase()} found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column}>{definition.columnLabels?.[column] ?? column.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</th>
                ))}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {visibleColumns.map((column) => <td key={column}>{formatCell(getNestedValue(item, column))}</td>)}
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

function FormField({
  field,
  value,
  onChange,
  options,
  file,
  onFileChange,
  uploadProgress,
  imageProgress,
  onImageUploaded,
  onSlugManuallyEdited,
  disabled = false,
}) {
  const id = `content-${field.name}`;
  if (field.type === 'markdownEditor') {
    return (
      <div className={styles.markdownField}>
        <span className={styles.markdownLabel}>{field.label}{field.required ? ' *' : ''}</span>
        <MarkdownArticleEditor
          value={value}
          onChange={onChange}
          onImageUploaded={onImageUploaded}
          required={field.required}
        />
      </div>
    );
  }
  if (field.type === 'projectFeatures') {
    return <ProjectFeaturesField field={field} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (field.type === 'projectGallery') {
    return <ProjectGalleryField field={field} value={value} onChange={onChange} imageProgress={imageProgress} disabled={disabled} />;
  }
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
      {field.type === 'textarea' || field.type === 'stringArray' ? (
        <textarea
          id={id}
          required={field.required}
          maxLength={field.maxLength}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          rows={field.name === 'body' || field.name === 'description' ? 8 : 4}
        />
      ) : field.type === 'serviceIcon' ? (
        <span className={styles.iconSelect}>
          <ServiceIcon name={value} />
          <select id={id} required={field.required} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
            {(options ?? field.options).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </span>
      ) : field.type === 'select' || field.relation ? (
        <select id={id} required={field.required} value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
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
          onChange={(event) => {
            if (field.name === 'slug') onSlugManuallyEdited?.();
            onChange(event.target.value);
          }}
        />
      )}
      {field.hint && <small>{field.hint}</small>}
    </label>
  );
}

function ProjectFeaturesField({ field, value, onChange, disabled }) {
  const features = Array.isArray(value) ? value : [];

  function updateFeature(index, key, nextValue) {
    onChange(features.map((feature, featureIndex) => (
      featureIndex === index ? { ...feature, [key]: nextValue } : feature
    )));
  }

  function moveFeature(index, direction) {
    const next = [...features];
    const target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <fieldset className={`${styles.fieldset} ${styles.projectFeatures}`}>
      <legend>{field.label}</legend>
      {features.map((feature, index) => (
        <article className={styles.featureEditor} key={feature.id ?? index}>
          <div className={styles.editorItemHeading}>
            <h4>Feature {index + 1}</h4>
            <div className={styles.editorItemActions}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`Move feature ${index + 1} up`}
                disabled={disabled || index === 0}
                onClick={() => moveFeature(index, -1)}
              >
                <ArrowUp aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`Move feature ${index + 1} down`}
                disabled={disabled || index === features.length - 1}
                onClick={() => moveFeature(index, 1)}
              >
                <ArrowDown aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`Remove feature ${index + 1}`}
                disabled={disabled}
                onClick={() => onChange(features.filter((_, featureIndex) => featureIndex !== index))}
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
          <label className={styles.field}>
            Feature title
            <input
              required
              maxLength={180}
              value={feature.title ?? ''}
              aria-label={`Feature ${index + 1} title`}
              onChange={(event) => updateFeature(index, 'title', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Short description
            <textarea
              required
              maxLength={500}
              value={feature.description ?? ''}
              aria-label={`Feature ${index + 1} description`}
              onChange={(event) => updateFeature(index, 'description', event.target.value)}
              rows={3}
            />
          </label>
        </article>
      ))}
      <button
        type="button"
        className={styles.projectAddButton}
        disabled={disabled || features.length >= 30}
        onClick={() => onChange([...features, { id: `feature-${++nextProjectEditorId}`, title: '', description: '' }])}
      >
        <Plus aria-hidden="true" size={16} />
        Add Feature
      </button>
    </fieldset>
  );
}

function ProjectGalleryField({ field, value, onChange, imageProgress, disabled }) {
  const images = Array.isArray(value) ? value : EMPTY_PROJECT_ITEMS;
  const [previews, setPreviews] = useState({});
  const [failedPreviews, setFailedPreviews] = useState({});
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const nextPreviews = Object.fromEntries(images
      .filter((image) => image.file)
      .map((image) => [
        image.id,
        typeof URL.createObjectURL === 'function' ? URL.createObjectURL(image.file) : '',
      ]));
    setPreviews(nextPreviews);
    return () => Object.values(nextPreviews).forEach((url) => {
      if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
    });
  }, [images]);

  function chooseImages(event) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length === 0) return;
    if (images.length + files.length > MAX_PROJECT_GALLERY_IMAGES) {
      setValidationError(`A project gallery can contain at most ${MAX_PROJECT_GALLERY_IMAGES} images.`);
      return;
    }
    const unsupported = files.find((file) => !SUPPORTED_IMAGE_TYPES.has(file.type));
    if (unsupported) {
      setValidationError('Choose JPEG, PNG, or WebP images.');
      return;
    }
    const oversized = files.find((file) => file.size > MAX_IMAGE_FILE_SIZE);
    if (oversized) {
      setValidationError('Images must be 5 MB or smaller.');
      return;
    }
    setValidationError('');
    onChange([
      ...images,
      ...files.map((file) => ({ id: `image-${++nextProjectEditorId}`, file })),
    ]);
  }

  function moveImage(index, direction) {
    const next = [...images];
    const target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <fieldset className={`${styles.fieldset} ${styles.projectGallery}`}>
      <legend>{field.label}</legend>
      <p className={styles.fieldHelp}>JPEG, PNG, or WebP. Maximum 5 MB per image; up to {MAX_PROJECT_GALLERY_IMAGES} images.</p>
      <label className={styles.galleryUpload}>
        <ImagePlus aria-hidden="true" size={18} />
        Add Project Images
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="Add project gallery images"
          disabled={disabled || images.length >= MAX_PROJECT_GALLERY_IMAGES}
          onChange={chooseImages}
        />
      </label>
      {validationError && <p className={styles.error} role="alert">{validationError}</p>}
      {images.length > 0 && (
        <ol className={styles.galleryEditor}>
          {images.map((image, index) => {
            const imageUrl = image.file ? previews[image.id] : getPublicImageUrl(image.url);
            const progress = imageProgress[`${field.name}-${image.id}`];
            return (
              <li className={styles.galleryEditorItem} key={image.id ?? image.url ?? index}>
                <div className={styles.galleryEditorPreview}>
                  {imageUrl
                    && !failedPreviews[image.id]
                    ? (
                      <img
                        src={imageUrl}
                        alt={`Project gallery image ${index + 1} preview`}
                        onError={() => setFailedPreviews((current) => ({ ...current, [image.id]: true }))}
                      />
                    )
                    : <span aria-label={`Project gallery image ${index + 1} preview unavailable`}>Preview unavailable</span>}
                </div>
                <div className={styles.editorItemHeading}>
                  <span>{image.file?.name ?? `Image ${index + 1}`}</span>
                  <div className={styles.editorItemActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Move image ${index + 1} up`}
                      disabled={disabled || index === 0}
                      onClick={() => moveImage(index, -1)}
                    >
                      <ArrowUp aria-hidden="true" size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Move image ${index + 1} down`}
                      disabled={disabled || index === images.length - 1}
                      onClick={() => moveImage(index, 1)}
                    >
                      <ArrowDown aria-hidden="true" size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Remove image ${index + 1}`}
                      disabled={disabled}
                      onClick={() => onChange(images.filter((_, imageIndex) => imageIndex !== index))}
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                </div>
                {progress !== undefined && (
                  <progress aria-label={`Uploading image ${index + 1}`} max="100" value={progress} />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </fieldset>
  );
}

function CompanyProfileEditor() {
  const [profile, setProfile] = useState(null);
  const [savedProfile, setSavedProfile] = useState(null);
  const [socialLinks, setSocialLinks] = useState([]);
  const [socialValues, setSocialValues] = useState({});
  const [savedSocialValues, setSavedSocialValues] = useState({});
  const [savingPlatform, setSavingPlatform] = useState('');
  const [socialForm, setSocialForm] = useState(null);
  const [savedSocialForm, setSavedSocialForm] = useState(null);
  const [pendingSocialDelete, setPendingSocialDelete] = useState(null);
  const [deletingSocialLink, setDeletingSocialLink] = useState(false);
  const [socialSaving, setSocialSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGroup, setSavingGroup] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useAutoDismissNotice();
  const [logoFile, setLogoFile] = useState(null);
  const [logoProgress, setLogoProgress] = useState(null);
  const [homeIntroImageFile, setHomeIntroImageFile] = useState(null);
  const [homeIntroImageProgress, setHomeIntroImageProgress] = useState(null);
  const [heroImageFiles, setHeroImageFiles] = useState({});
  const [heroImageProgress, setHeroImageProgress] = useState({});

  useEffect(() => {
    let active = true;
    Promise.all([
      getCompanyProfile(),
      listAdminContent('company-profile/social-links', { page: 1, pageSize: 100 }),
    ]).then(([profileResponse, socialResponse]) => {
      if (active) {
        const loadedProfile = withCompanyProfileDefaults(profileResponse.item);
        const loadedLinks = socialResponse.items ?? [];
        const loadedSocialValues = Object.fromEntries(DEFAULT_SOCIAL_PLATFORMS.map(({ platform }) => {
          const saved = loadedLinks.find((link) => link.platform.trim().toLowerCase() === platform);
          return [platform, saved?.url ?? ''];
        }));
        setProfile(loadedProfile);
        setSavedProfile(loadedProfile);
        setSocialLinks(loadedLinks);
        setSocialValues(loadedSocialValues);
        setSavedSocialValues(loadedSocialValues);
      }
    }).catch((requestError) => {
      if (active) setError(getErrorMessage(requestError));
    })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function hasProfileChanges(fieldNames) {
    if (!profile) return false;
    return fieldNames.some((name) => {
      if (name === 'logoUrl' && logoFile) return true;
      if (name === 'homeIntroImageUrl' && homeIntroImageFile) return true;
      if (COMPANY_HERO_IMAGE_FIELDS.includes(name) && heroImageFiles[name]) return true;
      return (profile[name] ?? '') !== (savedProfile?.[name] ?? '');
    });
  }

  function cancelProfileFields(fieldNames) {
    setProfile((current) => ({
      ...current,
      ...Object.fromEntries(fieldNames.map((name) => [name, savedProfile?.[name] ?? null])),
    }));
    if (fieldNames.includes('logoUrl')) {
      setLogoFile(null);
      setLogoProgress(null);
    }
    if (fieldNames.includes('homeIntroImageUrl')) {
      setHomeIntroImageFile(null);
      setHomeIntroImageProgress(null);
    }
    if (fieldNames.some((name) => COMPANY_HERO_IMAGE_FIELDS.includes(name))) {
      setHeroImageFiles((current) => Object.fromEntries(
        Object.entries(current).filter(([name]) => !fieldNames.includes(name)),
      ));
      setHeroImageProgress((current) => Object.fromEntries(
        Object.entries(current).filter(([name]) => !fieldNames.includes(name)),
      ));
    }
    setError('');
    setNotice('Unsaved company profile changes discarded.');
  }

  async function saveProfileFields(event, fieldNames, groupLabel) {
    event.preventDefault();
    if (saving || !hasProfileChanges(fieldNames)) return;
    setSaving(true);
    setSavingGroup(groupLabel);
    setError('');
    setNotice('');
    const uploadedImageUrls = [];
    let saved = false;
    try {
      const body = Object.fromEntries(fieldNames
        .filter((key) => (profile[key] ?? '') !== (savedProfile?.[key] ?? ''))
        .map((key) => [key, profile[key] === '' && key !== 'name' ? null : profile[key]]));
      const imageFiles = {
        logoUrl: logoFile,
        homeIntroImageUrl: homeIntroImageFile,
        ...heroImageFiles,
      };
      for (const fieldName of fieldNames) {
        if (!imageFiles[fieldName]) continue;
        const progressCallbacks = {
          logoUrl: setLogoProgress,
          homeIntroImageUrl: setHomeIntroImageProgress,
        };
        const onProgress = progressCallbacks[fieldName]
          ?? ((progress) => setHeroImageProgress((current) => ({ ...current, [fieldName]: progress })));
        const image = await uploadAdminImage('company-profile', imageFiles[fieldName], onProgress);
        uploadedImageUrls.push(image.url);
        body[fieldName] = image.url;
      }
      const response = await patchCompanyProfile(body);
      saved = true;
      const updatedProfile = withCompanyProfileDefaults(response.item);
      setProfile((current) => ({
        ...current,
        ...Object.fromEntries(fieldNames.map((name) => [name, updatedProfile[name]])),
      }));
      setSavedProfile(updatedProfile);
      if (fieldNames.includes('logoUrl')) {
        setLogoFile(null);
        setLogoProgress(null);
      }
      if (fieldNames.includes('homeIntroImageUrl')) {
        setHomeIntroImageFile(null);
        setHomeIntroImageProgress(null);
      }
      if (fieldNames.some((name) => COMPANY_HERO_IMAGE_FIELDS.includes(name))) {
        setHeroImageFiles((current) => Object.fromEntries(
          Object.entries(current).filter(([name]) => !fieldNames.includes(name)),
        ));
        setHeroImageProgress((current) => Object.fromEntries(
          Object.entries(current).filter(([name]) => !fieldNames.includes(name)),
        ));
      }
      const previousImages = COMPANY_PROFILE_IMAGE_FIELDS
        .filter((key) => fieldNames.includes(key) && Object.hasOwn(body, key) && body[key] !== savedProfile?.[key])
        .map((key) => savedProfile?.[key])
        .filter(Boolean);
      const cleanupFailures = await cleanupImages(previousImages);
      setNotice(`${groupLabel} saved.${cleanupFailures ? ' A previous image could not be removed; contact an administrator to retry cleanup.' : ''}`);
    } catch (requestError) {
      const cleanupFailures = saved ? 0 : await cleanupImages(uploadedImageUrls);
      setError(`${getErrorMessage(requestError)}${cleanupFailures ? ' An uploaded image could not be removed; contact an administrator to retry cleanup.' : ''}`);
    } finally {
      setSaving(false);
      setSavingGroup('');
    }
  }

  async function saveSocialPlatform(event, platform) {
    event.preventDefault();
    if (savingPlatform) return;
    const url = socialValues[platform]?.trim();
    if (!url || url === savedSocialValues[platform]) return;

    setSavingPlatform(platform);
    setError('');
    setNotice('');
    try {
      const existing = socialLinks.find((link) => link.platform.trim().toLowerCase() === platform);
      if (existing) {
        const body = { url };
        if (!existing.isActive) body.isActive = true;
        await patchAdminContent('company-profile/social-links', existing.id, body);
      } else {
        await createAdminContent('company-profile/social-links', {
          platform,
          url,
          sortOrder: DEFAULT_SOCIAL_PLATFORMS.findIndex((item) => item.platform === platform),
          isActive: true,
        });
      }
      const response = await listAdminContent('company-profile/social-links', { page: 1, pageSize: 100 });
      const updatedLinks = response.items ?? [];
      const updatedValues = Object.fromEntries(DEFAULT_SOCIAL_PLATFORMS.map(({ platform: name }) => {
        const saved = updatedLinks.find((link) => link.platform.trim().toLowerCase() === name);
        return [name, saved?.url ?? ''];
      }));
      setSocialLinks(updatedLinks);
      setSocialValues(updatedValues);
      setSavedSocialValues(updatedValues);
      setNotice(`${DEFAULT_SOCIAL_PLATFORMS.find((item) => item.platform === platform).label} link saved.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSavingPlatform('');
    }
  }

  async function submitSocialLink(event) {
    event.preventDefault();
    if (socialSaving) return;
    setSocialSaving(true);
    setError('');
    setNotice('');
    try {
      const fieldNames = ['url', 'sortOrder', 'isActive'];
      const body = Object.fromEntries(fieldNames
        .filter((field) => socialForm[field] !== savedSocialForm?.[field])
        .map((field) => [field, field === 'sortOrder' ? Number(socialForm[field]) : socialForm[field]]));
      if (Object.keys(body).length === 0) {
        setSocialForm(null);
        setSavedSocialForm(null);
        setNotice('No social link changes to save.');
        return;
      }
      await patchAdminContent('company-profile/social-links', socialForm.id, body);
      const response = await listAdminContent('company-profile/social-links', { page: 1, pageSize: 100 });
      setSocialLinks(response.items ?? []);
      setSocialForm(null);
      setSavedSocialForm(null);
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
    { name: 'homeHeroImage1Url', label: 'Hero Image 1', type: 'image', resource: 'company-profile' },
    { name: 'homeHeroImage2Url', label: 'Hero Image 2', type: 'image', resource: 'company-profile' },
    { name: 'homeHeroImage3Url', label: 'Hero Image 3', type: 'image', resource: 'company-profile' },
  ];
  const profileGroups = [
    {
      id: 'identity',
      title: 'Company information',
      description: 'Manage the company name, public tagline, and general description.',
      fields: ['name', 'tagline', 'description'],
    },
    {
      id: 'contact',
      title: 'Contact information',
      description: 'Update the contact details displayed across the public website.',
      fields: ['email', 'phone', 'location', 'hours'],
    },
    {
      id: 'brand',
      title: 'Brand assets',
      description: 'Update the company logo, home-page introduction image, and each hero slider image independently.',
      fields: COMPANY_PROFILE_IMAGE_FIELDS,
    },
  ];

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Content management</p>
      <h1>Company Profile</h1>
      <p className={styles.intro}>Edit company details by group. Saving one group leaves all other profile information unchanged.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      <div className={companyStyles.profileGroups}>
        {profileGroups.map((group) => {
          const groupFields = fields.filter((field) => group.fields.includes(field.name));
          const hasChanges = hasProfileChanges(group.fields);
              return (
            <form
              className={companyStyles.profileCard}
              key={group.id}
              aria-labelledby={`company-${group.id}-title`}
              aria-busy={saving && savingGroup === group.title}
              onSubmit={(event) => void saveProfileFields(event, group.fields, group.title)}
            >
              <header className={companyStyles.profileHeading}>
                <div>
                  <h2 id={`company-${group.id}-title`}>{group.title}</h2>
                  <p>{group.description}</p>
                </div>
              </header>
              <div className={`${styles.fields} ${companyStyles.profileFields}`}>
                {groupFields.map((field) => (
                  <FormField
                    key={field.name}
                    field={field}
                    value={field.name === 'homeIntroImageUrl'
                      ? profile?.homeIntroImageUrl || '/images/image1.jpg'
                      : profile?.[field.name] ?? ''}
                    file={field.name === 'homeIntroImageUrl'
                      ? homeIntroImageFile
                      : field.name === 'logoUrl' ? logoFile : heroImageFiles[field.name]}
                    uploadProgress={field.name === 'homeIntroImageUrl'
                      ? homeIntroImageProgress
                      : field.name === 'logoUrl' ? logoProgress : heroImageProgress[field.name]}
                    onFileChange={field.name === 'homeIntroImageUrl'
                      ? setHomeIntroImageFile
                      : field.name === 'logoUrl'
                        ? setLogoFile
                        : COMPANY_HERO_IMAGE_FIELDS.includes(field.name)
                          ? (file) => setHeroImageFiles((current) => ({ ...current, [field.name]: file }))
                          : undefined}
                    onChange={(value) => setProfile((current) => ({ ...current, [field.name]: value }))}
                  />
                ))}
              </div>
              <div className={companyStyles.profileActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={saving || !hasChanges}
                  onClick={() => cancelProfileFields(group.fields)}
                >
                  Cancel
                </button>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={saving || !hasChanges}
                >
                  {saving && savingGroup === group.title ? 'Saving…' : group.id === 'brand' ? 'Save profile' : `Save ${group.title.toLowerCase()}`}
                </button>
              </div>
            </form>
          );
        })}
      </div>

      <section className={styles.formCard} aria-labelledby="social-links-title">
        <div className={styles.formHeading}>
          <h2 id="social-links-title">Social links</h2>
        </div>
        <p className={styles.intro}>Update each platform independently. Existing links are updated in place; a platform without a saved link can be added here.</p>
        {DEFAULT_SOCIAL_PLATFORMS.map(({ platform, label }) => {
          const matchingLinks = socialLinks.filter((item) => item.platform.trim().toLowerCase() === platform);
          return (
            <form
              className={companyStyles.socialPlatformCard}
              key={platform}
              aria-label={`${label} social link`}
              onSubmit={(event) => void saveSocialPlatform(event, platform)}
            >
              <label htmlFor={`social-${platform}`}>{label} URL</label>
              <div className={companyStyles.socialPlatformControls}>
                <input
                  id={`social-${platform}`}
                  type="url"
                  maxLength={2048}
                  required
                  value={socialValues[platform] ?? ''}
                  onChange={(event) => setSocialValues((current) => ({ ...current, [platform]: event.target.value }))}
                  placeholder="https://"
                />
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={Boolean(savingPlatform) || !socialValues[platform]?.trim() || socialValues[platform]?.trim() === savedSocialValues[platform]}
                >
                  {savingPlatform === platform ? 'Saving…' : `Save ${label}`}
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={Boolean(savingPlatform) || socialValues[platform] === savedSocialValues[platform]}
                  onClick={() => setSocialValues((current) => ({ ...current, [platform]: savedSocialValues[platform] ?? '' }))}
                >
                  Cancel
                </button>
              </div>
              {matchingLinks.length > 1 && (
                <p className={companyStyles.duplicateWarning} role="status">
                  Multiple saved {label} entries were found. The first is shown; no saved links were removed.
                </p>
              )}
            </form>
          );
        })}
        {socialLinks.some((item) => !DEFAULT_SOCIAL_PLATFORMS.some(({ platform }) => item.platform.trim().toLowerCase() === platform)) && (
          <>
            <h3 className={companyStyles.additionalLinksHeading}>Other saved links</h3>
            <ul className={styles.socialList}>
              {socialLinks.filter((item) => !DEFAULT_SOCIAL_PLATFORMS.some(({ platform }) => item.platform.trim().toLowerCase() === platform)).map((item) => (
                <li key={item.id}>
                  <span><strong>{item.platform}</strong> — {item.url} {!item.isActive && '(inactive)'}</span>
                  <span className={styles.actions}>
                    <button className={styles.textButton} type="button" onClick={() => {
                      setSocialForm(item);
                      setSavedSocialForm(item);
                    }}>Edit</button>
                    <button className={styles.dangerButton} type="button" onClick={() => setPendingSocialDelete(item)}>Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {socialForm && (
          <form className={styles.fields} onSubmit={submitSocialLink}>
            <label className={styles.field} htmlFor="social-platform">
              Platform
              <input
                id="social-platform"
                value={socialForm.platform}
                readOnly
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
              <button className={styles.textButton} type="button" onClick={() => {
                setSocialForm(null);
                setSavedSocialForm(null);
              }}>Cancel</button>
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
