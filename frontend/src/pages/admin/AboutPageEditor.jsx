import { useEffect, useState } from 'react';
import { getAboutPageContent, updateAboutPageContent } from '../../services/adminContentApi.js';
import useAutoDismissNotice from '../../hooks/useAutoDismissNotice.js';
import styles from './AdminContentPage.module.css';
import editorStyles from './AboutPageEditor.module.css';

const sectionTitles = {
  whoWeAre: 'Who We Are',
  story: 'Our Story',
  missionVision: 'Mission and Vision',
  coreValues: 'Core Values',
  philosophy: 'Our Philosophy',
  team: 'Meet Our Team',
};

const fieldLabels = {
  label: 'Small label',
  title: 'Main heading',
  body: 'Body content',
  subheading: 'Subheading',
  description: 'Description',
  missionLabel: 'Mission label',
  missionTitle: 'Mission heading',
  missionDescription: 'Mission description',
  visionLabel: 'Vision label',
  visionTitle: 'Vision heading',
  visionDescription: 'Vision description',
  introduction: 'Introduction',
  closing: 'Closing sentence',
  buttonLabel: 'Button label',
  destination: 'Button destination',
  finalStatement: 'Final statement',
  sortOrder: 'Display order',
  icon: 'Icon',
};

function errorMessage(error) {
  if (error.status === 401) return 'Your admin session expired. Please sign in again.';
  if (error.status === 403) return 'You do not have permission to manage this content.';
  return error.message || 'The About page could not be saved.';
}

function FormField({ name, value, onChange, multiline = false, number = false, options, idPrefix = 'section', labelOverride }) {
  const id = `about-${idPrefix}-${name}`;
  const label = labelOverride ?? fieldLabels[name] ?? name.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
  if (name === 'isActive') {
    return (
      <label className={styles.checkboxField} htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        Active on public page
      </label>
    );
  }
  return (
    <label className={styles.field} htmlFor={id}>
      {label}
      {multiline ? (
        <textarea id={id} required value={value ?? ''} onChange={(event) => onChange(event.target.value)} rows={6} />
      ) : options ? (
        <select id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input
          id={id}
          type={number ? 'number' : 'text'}
          min={number ? 0 : undefined}
          step={number ? 1 : undefined}
          required
          value={value ?? ''}
          onChange={(event) => onChange(number ? Number(event.target.value) : event.target.value)}
        />
      )}
    </label>
  );
}

function ItemEditor({ item, index, sectionKey, onChange, icon = false }) {
  const update = (key, value) => onChange(sectionKey, index, key, value);
  const idPrefix = `${sectionKey}-${index}`;
  return (
    <div className={editorStyles.item}>
      <div className={editorStyles.itemHeading}>
        <h3>{icon ? 'Value' : 'Principle'} {index + 1}</h3>
      </div>
      <div className={styles.fields}>
        <FormField name="title" labelOverride={icon ? 'Value title' : 'Principle title'} idPrefix={idPrefix} value={item.title} onChange={(value) => update('title', value)} />
        <FormField name="sortOrder" idPrefix={idPrefix} value={item.sortOrder} number onChange={(value) => update('sortOrder', value)} />
        {icon && (
          <FormField
            name="icon"
            idPrefix={idPrefix}
            value={item.icon}
            onChange={(value) => update('icon', value)}
            options={[
              { value: 'spark', label: 'Innovation' },
              { value: 'star', label: 'Excellence' },
              { value: 'shield', label: 'Integrity' },
              { value: 'people', label: 'Collaboration' },
              { value: 'learning', label: 'Continuous learning' },
              { value: 'impact', label: 'Impact' },
            ]}
          />
        )}
        <FormField name="description" idPrefix={idPrefix} labelOverride={icon ? 'Value description' : 'Principle description'} value={item.description} multiline onChange={(value) => update('description', value)} />
        <FormField name="isActive" idPrefix={idPrefix} value={item.isActive} onChange={(value) => update('isActive', value)} />
      </div>
    </div>
  );
}

export default function AboutPageEditor() {
  const [savedContent, setSavedContent] = useState(null);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useAutoDismissNotice();

  useEffect(() => {
    let active = true;
    getAboutPageContent().then((response) => {
      if (active) {
        setSavedContent(response.item.content);
        setContent(response.item.content);
      }
    }).catch((requestError) => {
      if (active) setError(errorMessage(requestError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function updateSection(sectionKey, field, value) {
    setContent((current) => ({
      ...current,
      [sectionKey]: { ...current[sectionKey], [field]: value },
    }));
  }

  function updateItem(sectionKey, index, field, value) {
    setContent((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        [sectionKey === 'coreValues' ? 'values' : 'principles']: current[sectionKey][sectionKey === 'coreValues' ? 'values' : 'principles']
          .map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
      },
    }));
  }

  async function save(event) {
    event.preventDefault();
    if (saving || !content) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await updateAboutPageContent(content);
      setSavedContent(response.item.content);
      setContent(response.item.content);
      setNotice('About page content saved successfully.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setContent(savedContent);
    setError('');
    setNotice('Changes discarded.');
  }

  if (loading) return <p className={styles.state} role="status">Loading About page content…</p>;

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Website content</p>
          <h1>About Page</h1>
          <p>Edit the public story, purpose, values, philosophy, and team link.</p>
        </div>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      {content && (
        <form className={editorStyles.form} onSubmit={save}>
          {Object.entries(sectionTitles).map(([sectionKey, title]) => {
            const section = content[sectionKey];
            const arrayKey = sectionKey === 'coreValues' ? 'values' : sectionKey === 'philosophy' ? 'principles' : null;
            const fields = Object.keys(section).filter((key) => !['isActive', 'sortOrder', 'values', 'principles'].includes(key));
            return (
              <fieldset className={editorStyles.section} key={sectionKey}>
                <legend>{title}</legend>
                <div className={styles.fields}>
                  {fields.map((field) => (
                    <FormField
                      key={field}
                      name={field}
                      idPrefix={sectionKey}
                      value={section[field]}
                      multiline={['body', 'description', 'introduction', 'closing', 'missionDescription', 'visionDescription', 'finalStatement'].includes(field)}
                      onChange={(value) => updateSection(sectionKey, field, value)}
                    />
                  ))}
                  <FormField name="sortOrder" idPrefix={sectionKey} value={section.sortOrder} number onChange={(value) => updateSection(sectionKey, 'sortOrder', value)} />
                  <FormField name="isActive" idPrefix={sectionKey} value={section.isActive} onChange={(value) => updateSection(sectionKey, 'isActive', value)} />
                </div>
                {arrayKey && (
                  <div className={editorStyles.items}>
                    {section[arrayKey].map((item, index) => (
                      <ItemEditor
                        key={`${sectionKey}-${index}`}
                        item={item}
                        index={index}
                        sectionKey={sectionKey}
                        icon={sectionKey === 'coreValues'}
                        onChange={updateItem}
                      />
                    ))}
                  </div>
                )}
              </fieldset>
            );
          })}
          <div className={editorStyles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save About page'}
            </button>
            <button className={editorStyles.cancelButton} type="button" disabled={saving} onClick={cancel}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}