import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../assets/ztalent-logo.png';
import Button from '../common/Button.jsx';
import ThemeToggle from '../common/ThemeToggle.jsx';
import DesktopNavigation from './DesktopNavigation.jsx';
import MobileNavigation from './MobileNavigation.jsx';
import TopBar from './TopBar.jsx';
import styles from './Header.module.css';

export default function Header({ theme, onThemeToggle }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <TopBar />
      <header className={styles.header}>
        <div className={styles.container}>
          <Link className={styles.brand} to="/" onClick={closeMenu} aria-label="Ztalent Coder home">
            <img src={logo} alt="" />
            <span>
              ZTALENT CODER
              <small>Tech Company Solutions</small>
            </span>
          </Link>

          <div className={styles.desktopNavigation}>
            <DesktopNavigation />
          </div>

          <Button className={styles.quoteButton} to="/contact">Get a Quote</Button>

          <div className={styles.actions}>
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            <button
              className={styles.menuButton}
              type="button"
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">☰</span>
            </button>
          </div>
        </div>
        <div className={`${styles.mobileNavigation}${isMenuOpen ? ` ${styles.open}` : ''}`} id="mobile-navigation">
          <MobileNavigation isOpen={isMenuOpen} onNavigate={closeMenu} />
        </div>
      </header>
    </>
  );
}
