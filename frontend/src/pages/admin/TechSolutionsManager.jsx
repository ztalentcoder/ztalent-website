import { useState } from 'react';
import AdminContentPage from './AdminContentPage.jsx';
import styles from './TechSolutionsManager.module.css';

const sections = [
  { id: 'categories', label: 'Categories', resource: 'business-areas' },
  { id: 'services', label: 'Services', resource: 'services' },
];

export default function TechSolutionsManager() {
  const [activeSection, setActiveSection] = useState('categories');
  const section = sections.find((item) => item.id === activeSection) ?? sections[0];

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Services management</p>
          <h1>Tech Solutions</h1>
          <p>Manage Tech Solutions categories and the services shown on the public page.</p>
        </div>
      </header>
      <div className={styles.tabs} aria-label="Tech Solutions management sections">
        {sections.map((item) => (
          <button
            className={item.id === section.id ? styles.activeTab : ''}
            key={item.id}
            type="button"
            aria-pressed={item.id === section.id}
            onClick={() => setActiveSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <AdminContentPage resource={section.resource} scopeTechSolutions />
    </main>
  );
}
