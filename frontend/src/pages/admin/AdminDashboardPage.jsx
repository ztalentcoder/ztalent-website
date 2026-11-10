import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { getAdminDashboard } from '../../services/adminContentApi.js';
import styles from './AdminDashboardPage.module.css';

const overview = [
  { key: 'businessAreas', label: 'Business areas', to: '/admin/manage/business-areas' },
  { key: 'services', label: 'Services', to: '/admin/manage/services' },
  { key: 'projects', label: 'Projects', to: '/admin/manage/projects' },
  { key: 'blogPosts', label: 'Blog posts', to: '/admin/manage/blog-posts' },
  { key: 'teamMembers', label: 'Team members', to: '/admin/manage/team-members' },
  { key: 'newContactMessages', label: 'New contact messages', to: '/admin/manage/contact-messages' },
];

export default function AdminDashboardPage() {
  const { admin } = useAdminAuth();
  const visibleOverview = overview.filter((item) => (
    item.key !== 'newContactMessages' || admin?.role === 'SUPER_ADMIN'
  ));
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminDashboard();
      setCounts(response.counts);
    } catch {
      setError('Unable to load the content overview. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Administration</p>
        <h1>Content overview</h1>
        <p>Manage the content and messages used across the website.</p>
      </header>
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>Retry</button>
        </div>
      )}
      <section className={styles.cards} aria-label="Content counts" aria-busy={loading}>
        {visibleOverview.map((item) => (
          <Link className={styles.card} key={item.key} to={item.to}>
            <span>{item.label}</span>
            <strong>{loading ? '…' : counts?.[item.key] ?? 0}</strong>
          </Link>
        ))}
      </section>
    </main>
  );
}
