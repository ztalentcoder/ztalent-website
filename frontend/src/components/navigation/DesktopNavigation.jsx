import { NavLink } from 'react-router-dom';
import navigationLinks from './navigationLinks.js';
import styles from './Navigation.module.css';

export default function DesktopNavigation() {
  return (
    <nav className={styles.desktop} aria-label="Main navigation">
      {navigationLinks.map(({ label, to }) => (
        <NavLink
          className={({ isActive }) => `${styles.link}${isActive ? ` ${styles.active}` : ''}`}
          end={to === '/'}
          key={to}
          to={to}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
