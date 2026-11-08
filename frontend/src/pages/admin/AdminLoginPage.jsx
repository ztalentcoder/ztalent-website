import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import styles from './AdminLoginPage.module.css';

function getLoginErrorMessage(error) {
  if (error?.code === 'INVALID_CREDENTIALS' || error?.status === 401) {
    return 'The email or password is incorrect. Please try again.';
  }
  if (error?.code === 'RATE_LIMITED' || error?.status === 429) {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }
  if (!error?.status) {
    return 'Unable to connect right now. Check your connection and try again.';
  }
  return 'Unable to sign in right now. Please try again.';
}

function EyeIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
      <path d="M9.9 5.2A10.7 10.7 0 0112 5c5.4 0 9 5.4 9 7a8.8 8.8 0 01-2.7 3.8M6.2 6.2C3.9 7.8 3 10.6 3 12c0 1.6 3.6 7 9 7 1.1 0 2.1-.2 3-.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.2-7 9-7 9 7 9 7-3.2 7-9 7-9-7-9-7z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5m0 4h.01" />
    </svg>
  );
}

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const floatingEmail = Boolean(email);
  const floatingPassword = Boolean(password);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setToast('');
    try {
      await login(email, password);
      setPassword('');
      const requestedPath = location.state?.from?.pathname;
      navigate(requestedPath?.startsWith('/admin/') && requestedPath !== '/admin/login'
        ? requestedPath
        : '/admin/dashboard', { replace: true });
    } catch (error) {
      setToast(getLoginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      {toast && (
        <div className={styles.toast} role="alert" aria-live="assertive">
          <span className={styles.toastIcon}><ErrorIcon /></span>
          <span>{toast}</span>
        </div>
      )}
      <section className={styles.card} aria-labelledby="admin-login-title">
        <h1 id="admin-login-title">Welcome back</h1>
        <p className={styles.description}>Sign in to your account to continue</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={`${styles.field} ${floatingEmail ? styles.floating : ''}`}>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              placeholder=" "
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
            />
            <label htmlFor="admin-email">Email</label>
          </div>
          <div className={`${styles.field} ${styles.passwordField} ${floatingPassword ? styles.floating : ''}`}>
            <input
              id="admin-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder=" "
              required
              value={password}
              onChange={(event) => {
                const nextPassword = event.target.value;
                setPassword(nextPassword);
                if (!nextPassword) setShowPassword(false);
              }}
              disabled={submitting}
            />
            <label htmlFor="admin-password">Password</label>
            {password && (
              <button
                className={styles.visibilityButton}
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Reveal password'}
                aria-pressed={showPassword}
                disabled={submitting}
              >
                <EyeIcon visible={showPassword} />
              </button>
            )}
          </div>
          <button className={styles.submit} type="submit" disabled={submitting}>
            {submitting ? (
              <span className={styles.loadingText} role="status">
                Logging in<span className={styles.loadingDots} aria-hidden="true">...</span>
              </span>
            ) : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
}
