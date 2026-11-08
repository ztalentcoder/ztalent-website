import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

export function RequireAdmin() {
  const { status, error, retry } = useAdminAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <p role="status">Checking your admin session…</p>;
  }
  if (status === 'error') {
    return (
      <section role="alert">
        <p>{error}</p>
        <button type="button" onClick={retry}>Try again</button>
      </section>
    );
  }
  if (status !== 'authenticated') {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RedirectAuthenticatedAdmin() {
  const { status, error, retry } = useAdminAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <p role="status">Checking your admin session…</p>;
  }
  if (status === 'error') {
    return (
      <section role="alert">
        <p>{error}</p>
        <button type="button" onClick={retry}>Try again</button>
      </section>
    );
  }
  if (status === 'authenticated') {
    const requestedPath = location.state?.from?.pathname;
    const destination = requestedPath?.startsWith('/admin/') && requestedPath !== '/admin/login'
      ? requestedPath
      : '/admin/dashboard';
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}
