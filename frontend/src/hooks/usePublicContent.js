import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPublicContent } from '../services/publicContentApi.js';

export default function usePublicContent(path, query = {}) {
  const queryKey = JSON.stringify(query);
  const stableQuery = useMemo(() => JSON.parse(queryKey), [queryKey]);
  const [state, setState] = useState({ status: 'loading', data: null, error: '', errorStatus: null });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', data: null, error: '', errorStatus: null });
    getPublicContent(path, stableQuery).then((data) => {
      if (active) setState({ status: 'success', data, error: '', errorStatus: null });
    }).catch((error) => {
      if (active) setState({
        status: 'error',
        data: null,
        error: error.message || 'Public content is temporarily unavailable.',
        errorStatus: error.status ?? null,
      });
    });
    return () => { active = false; };
  }, [path, stableQuery, attempt]);

  return { ...state, retry };
}
