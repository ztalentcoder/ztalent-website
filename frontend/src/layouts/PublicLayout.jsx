import { useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Footer from '../components/layout/Footer.jsx';
import Header from '../components/navigation/Header.jsx';
import PublicPageMotion from '../components/public/PublicPageMotion.jsx';
import { PublicContentProvider } from '../context/PublicContentContext.jsx';

function getInitialTheme() {
  try {
    const savedTheme = window.localStorage.getItem('ztalent-theme');
    return savedTheme === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.warn('Theme preference could not be read from local storage.', error);
    return 'light';
  }
}

export default function PublicLayout() {
  const [theme, setTheme] = useState(getInitialTheme);
  const location = useLocation();

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#061a31' : '#08223d',
    );
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem('ztalent-theme', theme);
    } catch (error) {
      console.warn('Theme preference could not be saved to local storage.', error);
    }
  }, [theme]);

  useLayoutEffect(() => () => {
    document.documentElement.dataset.theme = 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#08223d');
  }, []);

  const toggleTheme = () => setTheme((current) => current === 'light' ? 'dark' : 'light');

  return (
    <PublicContentProvider>
      <>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Header theme={theme} onThemeToggle={toggleTheme} />
        <div id="main-content">
          <PublicPageMotion key={location.pathname}>
            <Outlet />
          </PublicPageMotion>
        </div>
        <Footer />
      </>
    </PublicContentProvider>
  );
}
