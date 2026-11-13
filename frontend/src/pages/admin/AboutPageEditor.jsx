import { useEffect, useState } from 'react';
import { getAboutPageContent, updateAboutPageContent } from '../../services/adminContentApi.js';
import useAutoDismissNotice from '../../hooks/useAutoDismissNotice.js';
import styles from './AdminContentPage.module.css';
import editorStyles from './AboutPageEditor.module.css';

const sectionTitles = {
  whoWeAre: {
    title: 'Who We Are',
    description: "Introduce Ztalent Coder and explain what the organization does.",
  },
  story: {
    title: 'Our Story',
    description: 'Share the journey, background, and ideas that shaped the organization.',
  },
  missionVision: {
    title: 'Mission and Vision',
    description: "Describe the organization's purpose and the future it is working toward.",
  },
  coreValues: {
    title: 'Core Values',
    description: 'Manage the principles that guide the organization and how each appears publicly.',
  },
  philosophy: {
    title: 'Our Philosophy',
    description: "Explain the approach behind the organization's work and its guiding principles.",
  },
  team: {
    title: 'Meet Our Team',
    description: 'Introduce the team section and configure its button destination.',
  },
  closing: {
    title: 'Closing Statement',
    description: 'Set the final message shown at the end of the public About page.',
  },
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

function FormField({
  name,
  value,
  onChange,
  multiline = false,
  number = false,
  options,
  idPrefix = 'section',
  labelOverride,
  rows = 4,
  className = '',
}) {
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
    <label className={`${styles.field}${className ? ` ${className}` : ''}`} htmlFor={id}>
      {label}
      {multiline ? (
        <textarea id={id} required value={value ?? ''} onChange={(event) => onChange(event.target.value)} rows={rows} />
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

function SectionFields({ section, sectionKey, fields, onChange }) {
  return (
    <div className={editorStyles.fields}>
      {fields.map((field) => {
        const multiline = ['body', 'description', 'introduction', 'closing', 'missionDescription', 'visionDescription', 'finalStatement'].includes(field);
        const rows = field === 'body' || field === 'introduction' ? 10 : 6;
        return (
          <FormField
            key={field}
            name={field}
            idPrefix={sectionKey}
            value={section[field]}
            multiline={multiline}
            rows={rows}
            className={multiline ? editorStyles.longField : ''}
            onChange={(value) => onChange(sectionKey, field, value)}
          />
        );
      })}
    </div>
  );
}

function SectionSettings({ section, sectionKey, onChange }) {
  return (
    <div className={editorStyles.settings} role="group" aria-label="Display settings">
      <div>
        <h3>Display settings</h3>
        <p>Control the order and visibility of this section on the public page.</p>
      </div>
      <div className={editorStyles.settingsFields}>
        <FormField
          name="sortOrder"
          idPrefix={sectionKey}
          value={section.sortOrder}
          number
          onChange={(value) => onChange(sectionKey, 'sortOrder', value)}
        />
        <FormField
          name="isActive"
          idPrefix={sectionKey}
          value={section.isActive}
          onChange={(value) => onChange(sectionKey, 'isActive', value)}
        />
      </div>
    </div>
  );
}

function ItemEditor({ item, index, sectionKey, onChange, icon = false }) {
  const update = (key, value) => onChange(sectionKey, index, key, value);
  const idPrefix = `${sectionKey}-${index}`;
  return (
    <div className={editorStyles.item}>
      <div className={editorStyles.itemHeading}>
        <h3>{icon ? 'Value' : 'Principle'} {index + 1}</h3>
        <p>{icon ? 'Edit the value shown on the public page.' : 'Edit this guiding principle.'}</p>
      </div>
      <div className={editorStyles.itemFields}>
        <div className={editorStyles.itemTopFields}>
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
        </div>
        <FormField
          name="description"
          idPrefix={idPrefix}
          labelOverride={icon ? 'Value description' : 'Principle description'}
          value={item.description}
          multiline
          rows={6}
          className={editorStyles.longField}
          onChange={(value) => update('description', value)}
        />
        <div className={editorStyles.itemSettings}>
          <FormField name="isActive" idPrefix={idPrefix} value={item.isActive} onChange={(value) => update('isActive', value)} />
        </div>
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
          <p>Manage the text, values, philosophy, team link, and closing message displayed on the public About page.</p>
        </div>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      {content && (
        <form className={editorStyles.form} onSubmit={save} aria-busy={saving}>
          {Object.entries(sectionTitles).map(([sectionKey, sectionInfo]) => {
            const section = content[sectionKey];
            const arrayKey = sectionKey === 'coreValues' ? 'values' : sectionKey === 'philosophy' ? 'principles' : null;
            return (
              <fieldset className={editorStyles.section} key={sectionKey} aria-describedby={`about-${sectionKey}-description`}>
                <legend>{sectionInfo.title}</legend>
                <p className={editorStyles.sectionDescription} id={`about-${sectionKey}-description`}>
                  {sectionInfo.description}
                </p>
                {sectionKey === 'missionVision' ? (
                  <>
                    <div className={editorStyles.missionGrid}>
                      <section className={editorStyles.subsection}>
                        <div className={editorStyles.subsectionHeading}>
                          <h3>Mission</h3>
                          <p>Describe the purpose of the organization.</p>
                        </div>
                        <SectionFields
                          section={section}
                          sectionKey={sectionKey}
                          fields={['missionLabel', 'missionTitle', 'missionDescription']}
                          onChange={updateSection}
                        />
                      </section>
                      <section className={editorStyles.subsection}>
                        <div className={editorStyles.subsectionHeading}>
                          <h3>Vision</h3>
                          <p>Describe the future the organization is working toward.</p>
                        </div>
                        <SectionFields
                          section={section}
                          sectionKey={sectionKey}
                          fields={['visionLabel', 'visionTitle', 'visionDescription']}
                          onChange={updateSection}
                        />
                      </section>
                    </div>
                    <SectionSettings section={section} sectionKey={sectionKey} onChange={updateSection} />
                  </>
                ) : sectionKey === 'coreValues' ? (
                  <>
                    <SectionFields section={section} sectionKey={sectionKey} fields={['label', 'title', 'description']} onChange={updateSection} />
                    <SectionSettings section={section} sectionKey={sectionKey} onChange={updateSection} />
                    <div className={editorStyles.collectionHeading}>
                      <h3>Individual values</h3>
                      <p>Manage each of the six values independently.</p>
                    </div>
                    <div className={editorStyles.items}>
                      {section[arrayKey].map((item, index) => (
                        <ItemEditor key={`${sectionKey}-${index}`} item={item} index={index} sectionKey={sectionKey} icon onChange={updateItem} />
                      ))}
                    </div>
                  </>
                ) : sectionKey === 'philosophy' ? (
                  <>
                    <SectionFields section={section} sectionKey={sectionKey} fields={['label', 'title', 'introduction', 'closing']} onChange={updateSection} />
                    <SectionSettings section={section} sectionKey={sectionKey} onChange={updateSection} />
                    <div className={editorStyles.collectionHeading}>
                      <h3>Guiding principles</h3>
                      <p>Manage each principle independently.</p>
                    </div>
                    <div className={editorStyles.items}>
                      {section[arrayKey].map((item, index) => (
                        <ItemEditor key={`${sectionKey}-${index}`} item={item} index={index} sectionKey={sectionKey} onChange={updateItem} />
                      ))}
                    </div>
                  </>
                ) : sectionKey === 'team' ? (
                  <>
                    <SectionFields section={section} sectionKey={sectionKey} fields={['label', 'title', 'description']} onChange={updateSection} />
                    <div className={editorStyles.relatedFields}>
                      <div className={editorStyles.subsectionHeading}>
                        <h3>Team button</h3>
                        <p>Choose the link text and destination for the team page.</p>
                      </div>
                      <SectionFields section={section} sectionKey={sectionKey} fields={['buttonLabel', 'destination']} onChange={updateSection} />
                    </div>
                    <SectionSettings section={section} sectionKey={sectionKey} onChange={updateSection} />
                  </>
                ) : sectionKey === 'closing' ? (
                  <>
                    <SectionFields section={section} sectionKey={sectionKey} fields={['title', 'body', 'finalStatement']} onChange={updateSection} />
                    <SectionSettings section={section} sectionKey={sectionKey} onChange={updateSection} />
                  </>
                ) : (
                  <>
                    <SectionFields
                      section={section}
                      sectionKey={sectionKey}
                      fields={sectionKey === 'story' ? ['label', 'title', 'subheading', 'body'] : ['label', 'title', 'body']}
                      onChange={updateSection}
                    />
                    <SectionSettings section={section} sectionKey={sectionKey} onChange={updateSection} />
                  </>
                )}
              </fieldset>
            );
          })}
          <div className={editorStyles.actions}>
            <p>Changes appear on the public About page after they are saved.</p>
            <div className={editorStyles.actionButtons}>
              <button className={editorStyles.cancelButton} type="button" disabled={saving} onClick={cancel}>Cancel</button>
              <button className={styles.primaryButton} type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save About page'}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}