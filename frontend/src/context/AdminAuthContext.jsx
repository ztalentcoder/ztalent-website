import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AdminAuthApiError,
  getCurrentAdmin,
  loginAdmin,
  logoutAdmin,
} from '../services/adminAuthApi.js';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [admin, setAdmin] = useState(null);
  const [error, setError] = useState(null);

  const checkSession = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const response = await getCurrentAdmin();
      setAdmin(response.admin);
      setStatus('authenticated');
      return response.admin;
    } catch (requestError) {
      setAdmin(null);
      if (requestError instanceof AdminAuthApiError && requestError.status === 401) {
        setStatus('unauthenticated');
        return null;
      }

      setStatus('error');
      setError('Unable to verify your admin session. Check your connection and try again.');
      return null;
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = useCallback(async (identifier, password) => {
    setError(null);
    try {
      const response = await loginAdmin(identifier, password);
      setAdmin(response.admin);
      setStatus('authenticated');
      return response.admin;
    } catch (requestError) {
      setAdmin(null);
      setStatus('unauthenticated');
      throw requestError;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await logoutAdmin();
      setAdmin(null);
      setStatus('unauthenticated');
    } catch {
      setError('Unable to log out. Please try again.');
      throw new Error('Admin logout failed.');
    }
  }, []);

  const updateAdmin = useCallback((updatedAdmin) => {
    if (!updatedAdmin || updatedAdmin.id !== admin?.id) {
      throw new Error('The authenticated administrator could not be updated.');
    }
    setAdmin(updatedAdmin);
    setStatus('authenticated');
  }, [admin?.id]);

  const value = useMemo(() => ({
    status,
    admin,
    error,
    login,
    logout,
    updateAdmin,
    retry: checkSession,
  }), [status, admin, error, login, logout, updateAdmin, checkSession]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider.');
  }
  return context;
}
