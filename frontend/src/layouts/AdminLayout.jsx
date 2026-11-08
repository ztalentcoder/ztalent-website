import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { adminNavigation } from '../pages/admin/contentResources.js';
import styles from './AdminLayout.module.css';

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const navigationGroups = adminNavigation.reduce((groups, item) => {
    if (item.to === '/admin/manage/contact-messages' && admin?.role !== 'SUPER_ADMIN') return groups;
    groups[item.group] ??= [];
    groups[item.group].push(item);
    return groups;
  }, {});

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      navigate('/admin/login', { replace: true });
    } catch {
      setLogoutError('Unable to log out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div
      className={`${styles.shell} ${admin ? styles.authenticatedShell : ''}`}
      data-admin-layout={admin ? 'authenticated' : undefined}
    >
      {admin && (
        <header className={styles.header}>
          <p className={styles.brand}>Ztalent Coder Admin</p>
          <div className={styles.account}>
            <div className={styles.identity}>
              <strong>{admin.name}</strong>
              <span className={styles.email}>{admin.email}</span>
              <span className={styles.role}>{admin.role}</span>
            </div>
            <button
              className={styles.logout}
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>
      )}
      {admin && (
        <nav className={styles.navigation} aria-label="Admin navigation">
          {Object.entries(navigationGroups).map(([group, items]) => (
            <section className={styles.navigationGroup} key={group}>
              <h2>{group}</h2>
              {items.map((item) => (
                <NavLink key={item.to} to={item.to}>
                  {item.label}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
      )}
      {logoutError && <p className={styles.error} role="alert">{logoutError}</p>}
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}
