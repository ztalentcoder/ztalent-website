import { NavLink } from 'react-router-dom';
import navigationLinks from './navigationLinks.js';
import styles from './Navigation.module.css';

export default function MobileNavigation({ isOpen, onNavigate }) {
  if (!isOpen) return null;

  return (
    <nav className={styles.mobile} aria-label="Mobile navigation">
      {navigationLinks.map(({ label, to }) => (
        <NavLink
          className={({ isActive }) => `${styles.mobileLink}${isActive ? ` ${styles.active}` : ''}`}
          end={to === '/'}
          key={to}
          onClick={onNavigate}
          to={to}
        >
          {label}
        </NavLink>
      ))}
      <NavLink className={styles.mobileCta} onClick={onNavigate} to="/contact">
        Get a Quote
      </NavLink>
    </nav>
  );
}
