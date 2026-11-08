import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Footer from '../components/layout/Footer.jsx';
import Header from '../components/navigation/Header.jsx';
import { PublicContentProvider } from '../context/PublicContentContext.jsx';

function getInitialTheme() {
  const savedTheme = window.localStorage.getItem('ztalent-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function PublicLayout() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('ztalent-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => current === 'light' ? 'dark' : 'light');

  return (
    <PublicContentProvider>
      <>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Header theme={theme} onThemeToggle={toggleTheme} />
        <div id="main-content">
          <Outlet />
        </div>
        <Footer />
      </>
    </PublicContentProvider>
  );
}
