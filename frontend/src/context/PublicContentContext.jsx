import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getPublicContent } from '../services/publicContentApi.js';

const PublicContentContext = createContext({ company: null, status: 'loading', error: '' });

export function PublicContentProvider({ children }) {
  const [state, setState] = useState({ company: null, status: 'loading', error: '' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    setState({ company: null, status: 'loading', error: '' });
    getPublicContent('company-profile').then((response) => {
      if (active) setState({ company: response.item ?? null, status: 'success', error: '' });
    }).catch((error) => {
      if (active) setState({
        company: null,
        status: 'error',
        error: error.message || 'Company information is temporarily unavailable.',
      });
    });
    return () => { active = false; };
  }, [attempt]);

  return <PublicContentContext.Provider value={{ ...state, retry }}>{children}</PublicContentContext.Provider>;
}

export function usePublicCompany() {
  return useContext(PublicContentContext);
}
