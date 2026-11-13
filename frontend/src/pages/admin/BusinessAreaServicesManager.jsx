import { useEffect, useState } from 'react';
import AdminContentPage from './AdminContentPage.jsx';
import { listAdminContent } from '../../services/adminContentApi.js';
import styles from './BusinessAreaServicesManager.module.css';

const areaDefinitions = {
  academic: {
    name: 'Academic',
    resource: 'services',
    aliases: ['academic'],
    tabs: [
      { resource: 'services', label: 'Services' },
      { resource: 'service-categories', label: 'Service Categories' },
      { resource: 'academic-courses', label: 'Courses' },
      { resource: 'course-categories', label: 'Course Categories' },
    ],
  },
  'tech-solutions': {
    name: 'Tech Solutions',
    resource: 'services',
    aliases: ['tech-solutions', 'technology-solutions'],
    tabs: [
      { resource: 'services', label: 'Services' },
    ],
  },
  'data-ai': {
    name: 'Data & AI',
    resource: 'services',
    aliases: ['data-ai', 'data-and-ai'],
    tabs: [
      { resource: 'services', label: 'Services' },
    ],
  },
};

function normalizeArea(value) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? '';
}

export default function BusinessAreaServicesManager({ area }) {
  const definition = areaDefinitions[area];
  const [businessArea, setBusinessArea] = useState(null);
  const [activeResource, setActiveResource] = useState(definition.tabs[0].resource);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listAdminContent('business-areas', { page: 1, pageSize: 100 })
      .then(({ items }) => {
        const foundByAlias = items.find((item) => definition.aliases.includes(normalizeArea(item.slug))
          || definition.aliases.includes(normalizeArea(item.name)));
        const knownOtherAreaAliases = Object.entries(areaDefinitions)
          .filter(([key]) => key !== area)
          .flatMap(([, otherDefinition]) => otherDefinition.aliases);
        const legacyAcademicCandidates = area === 'academic'
          ? items.filter((item) => !knownOtherAreaAliases.includes(normalizeArea(item.slug))
            && !knownOtherAreaAliases.includes(normalizeArea(item.name)))
          : [];
        const found = foundByAlias ?? (legacyAcademicCandidates.length === 1 ? legacyAcademicCandidates[0] : null);
        if (!found) throw new Error(`Create the ${definition.name} Business Area before managing its content.`);
        if (active) setBusinessArea(found);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || `Unable to load the ${definition.name} Business Area.`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [definition]);

  if (loading) return <p role="status">Loading {definition.name} management…</p>;
  if (error) {
    return (
      <main className={styles.page}>
        <h1>{definition.name}</h1>
        <p className={styles.error} role="alert">{error}</p>
        <AdminContentPage resource="business-areas" />
      </main>
    );
  }

  const selectedTab = definition.tabs.find((tab) => tab.resource === activeResource) ?? definition.tabs[0];
  const areaScoped = ['services', 'service-categories'].includes(selectedTab.resource);

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Business area management</p>
          <h1>{definition.name}</h1>
          <p>Manage content assigned to the {definition.name} Business Area.</p>
        </div>
      </header>
      <nav className={styles.tabs} aria-label={`${definition.name} management sections`}>
        {definition.tabs.map((tab) => (
          <button
            className={tab.resource === selectedTab.resource ? styles.activeTab : ''}
            key={tab.resource}
            type="button"
            aria-pressed={tab.resource === selectedTab.resource}
            onClick={() => setActiveResource(tab.resource)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <AdminContentPage
        resource={selectedTab.resource}
        scopedBusinessArea={areaScoped ? businessArea : undefined}
        techSolutionsMode={area === 'tech-solutions' && selectedTab.resource === 'services'}
      />
    </main>
  );
}
