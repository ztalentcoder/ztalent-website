import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { getAdminDashboard } from '../services/adminContentApi.js';
import { adminNavigation } from '../pages/admin/contentResources.js';
import styles from './AdminLayout.module.css';

const iconPaths = {
  dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>,
  company: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 21v-4h6v4M8 7h1m6 0h1m-8 4h1m6 0h1" /></>,
  about: <><path d="M12 17v-5m0-4h.01" /><circle cx="12" cy="12" r="9" /></>,
  chart: <><path d="M4 19V5m0 14h17" /><path d="m7 15 4-4 3 2 5-6" /></>,
  services: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  course: <><path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5m4-2v6" /></>,
  tech: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4m-5-9 3-3 2 2 3-4" /></>,
  brain: <><path d="M12 18V5a3 3 0 0 0-5.8-1 4 4 0 0 0-2.1 7.3A4 4 0 0 0 7 18h5Zm0 0V5a3 3 0 0 1 5.8-1 4 4 0 0 1 2.1 7.3A4 4 0 0 1 17 18h-5ZM8 21h8" /></>,
  portfolio: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18m-11 0v2h4v-2" /></>,
  quote: <><path d="M10 11H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4m14-7h-5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4" /></>,
  news: <><path d="M4 4h14a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4Z" /><path d="M8 8h8m-8 4h8m-8 4h5M4 18a2 2 0 0 1-2-2V6" /></>,
  tags: <><path d="m20 13-7 7-11-11V2h7l11 11Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.5a4 4 0 0 1 0 7.75M20 15a4 4 0 0 1 2 3.5V21" /></>,
  inquiries: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z" /></>,
  logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
  chevron: <path d="m7 10 5 5 5-5" />,
  collapse: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18m6-12-3 3 3 3" /></>,
  expand: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18m6-12 3 3-3 3" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

function Icon({ name }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

function getPageTitle(pathname) {
  const item = adminNavigation.find((entry) => entry.to === pathname);
  return item?.pageTitle ?? item?.label ?? 'Admin';
}

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [newMessageCount, setNewMessageCount] = useState(null);
  const [countUnavailable, setCountUnavailable] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const countRequestId = useRef(0);

  const menuRows = useMemo(() => {
    const rows = [];
    const groups = new Map();
    for (const item of adminNavigation) {
      if (!item.group) {
        rows.push({ type: 'link', item });
      } else if (groups.has(item.group)) {
        groups.get(item.group).items.push(item);
      } else {
        const row = { type: 'group', label: item.group, items: [item] };
        groups.set(item.group, row);
        rows.push(row);
      }
    }
    return rows;
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (admin?.role !== 'SUPER_ADMIN') return;
    const requestId = ++countRequestId.current;
    setCountUnavailable(false);
    try {
      const response = await getAdminDashboard();
      const count = response?.counts?.newContactMessages;
      if (!Number.isInteger(count) || count < 0) {
        throw new Error('The unread inquiry count was not provided.');
      }
      if (requestId === countRequestId.current) setNewMessageCount(count);
    } catch {
      if (requestId === countRequestId.current) {
        setNewMessageCount(null);
        setCountUnavailable(true);
      }
    }
  }, [admin?.role]);

  useEffect(() => {
    const activeGroup = adminNavigation.find((item) => item.group && item.to === location.pathname);
    setExpandedGroup(activeGroup?.group ?? null);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (admin?.role !== 'SUPER_ADMIN') {
      countRequestId.current += 1;
      setNewMessageCount(null);
      setCountUnavailable(false);
      return undefined;
    }
    void refreshUnreadCount();
    return undefined;
  }, [admin?.role, location.pathname, refreshUnreadCount]);

  useEffect(() => {
    if (admin?.role !== 'SUPER_ADMIN') return undefined;
    window.addEventListener('admin-contact-messages-updated', refreshUnreadCount);
    return () => window.removeEventListener('admin-contact-messages-updated', refreshUnreadCount);
  }, [admin?.role, refreshUnreadCount]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    const closeOnDesktopResize = () => {
      if (window.innerWidth > 900) setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnDesktopResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnDesktopResize);
    };
  }, [mobileOpen]);

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

  const displayName = admin?.username || admin?.name || 'Admin';
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A';

  return (
    <div
      className={`${styles.shell} ${admin ? styles.authenticatedShell : ''} ${collapsed ? styles.collapsedShell : ''}`}
      data-admin-layout={admin ? 'authenticated' : undefined}
    >
      {admin && (
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              className={styles.mobileMenuToggle}
              type="button"
              aria-label={mobileOpen ? 'Close admin navigation' : 'Open admin navigation'}
              aria-controls="admin-sidebar"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
            >
              <Icon name={mobileOpen ? 'close' : 'menu'} />
            </button>
            <p className={styles.brand}>Ztalent Coder Admin</p>
            <span className={styles.breadcrumbDivider} aria-hidden="true">/</span>
            <p className={styles.pageTitle}>{getPageTitle(location.pathname)}</p>
          </div>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">{initials}</span>
            <div className={styles.identity}>
              <strong>{displayName}</strong>
              <span className={styles.role}>{admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Assistant Admin'}</span>
            </div>
          </div>
        </header>
      )}
      {admin && mobileOpen && (
        <button
          className={styles.backdrop}
          type="button"
          aria-label="Close admin navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {admin && (
        <aside
          id="admin-sidebar"
          className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}
          aria-label="Admin sidebar"
        >
          <nav className={styles.navigation} aria-label="Admin navigation">
            {menuRows.map((row) => {
              if (row.type === 'link') {
                const { item } = row;
                if (item.superAdminOnly && admin.role !== 'SUPER_ADMIN') return null;
                if (item.disabled) {
                  return (
                    <button
                      className={`${styles.navLink} ${styles.disabledLink}`}
                      key={item.label}
                      type="button"
                      disabled
                      title={item.description}
                      aria-label={`${item.label}, unavailable`}
                    >
                      <Icon name={item.icon} />
                      <span className={styles.navLabel}>{item.label}</span>
                      <span className={styles.unavailableLabel}>Unavailable</span>
                    </button>
                  );
                }
                const inquiryLabel = item.inquiries && newMessageCount > 0
                  ? `${item.label}, ${newMessageCount} unread messages`
                  : item.label;
                const title = collapsed
                  ? (item.inquiries && countUnavailable ? `${item.label} (count unavailable)` : item.label)
                  : undefined;
                return (
                  <NavLink
                    className={({ isActive }) => `${styles.navLink} ${isActive ? styles.activeLink : ''}`}
                    key={item.to}
                    to={item.to}
                    title={title}
                    aria-label={inquiryLabel}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon name={item.icon} />
                    <span className={styles.navLabel}>{item.label}</span>
                    {item.inquiries && newMessageCount > 0 && (
                      <span className={styles.badge} aria-hidden="true">{newMessageCount > 99 ? '99+' : newMessageCount}</span>
                    )}
                    {item.inquiries && countUnavailable && (
                      <span className={styles.countUnavailable}>Unavailable</span>
                    )}
                  </NavLink>
                );
              }

              const isOpen = expandedGroup === row.label;
              const hasActiveItem = row.items.some((item) => item.to === location.pathname);
              return (
                <section
                  className={`${styles.navigationGroup} ${isOpen ? styles.groupExpanded : ''} ${hasActiveItem ? styles.groupActive : ''}`}
                  key={row.label}
                >
                  <button
                    className={styles.groupToggle}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`admin-group-${row.label.replaceAll(' ', '-').toLowerCase()}`}
                    aria-label={collapsed ? row.label : undefined}
                    title={collapsed ? row.label : undefined}
                    onClick={() => setExpandedGroup((current) => current === row.label ? null : row.label)}
                  >
                    <Icon name={row.items[0].groupIcon} />
                    <span className={styles.navLabel}>{row.label}</span>
                    <Icon name="chevron" />
                  </button>
                  <div
                    className={styles.submenu}
                    id={`admin-group-${row.label.replaceAll(' ', '-').toLowerCase()}`}
                    aria-hidden={!isOpen}
                    inert={!isOpen}
                  >
                    <div className={styles.submenuInner}>
                      {row.items.map((item) => (
                        <NavLink
                          className={({ isActive }) => `${styles.submenuLink} ${isActive ? styles.activeSubmenuLink : ''}`}
                          key={item.to}
                          to={item.to}
                          aria-label={item.label}
                          title={collapsed ? item.label : undefined}
                          onClick={() => setMobileOpen(false)}
                        >
                          <Icon name={item.icon} />
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </nav>
          <div className={styles.sidebarFooter}>
            <button
              className={styles.collapseToggle}
              type="button"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              <Icon name={collapsed ? 'expand' : 'collapse'} />
              <span className={styles.navLabel}>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
            </button>
            <button
              className={styles.logout}
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title={collapsed ? 'Log out' : undefined}
            >
              <Icon name="logout" />
              <span className={styles.navLabel}>{loggingOut ? 'Signing out…' : 'Log out'}</span>
            </button>
          </div>
        </aside>
      )}
      {logoutError && <p className={styles.error} role="alert">{logoutError}</p>}
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}
