import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPublicContent } from '../services/publicContentApi.js';

export default function usePublicContent(path, query = {}, { refreshIntervalMs = 0 } = {}) {
  const queryKey = JSON.stringify(query);
  const stableQuery = useMemo(() => JSON.parse(queryKey), [queryKey]);
  const [state, setState] = useState({ status: 'loading', data: null, error: '', errorStatus: null });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    let requestInProgress = false;
    const load = async (showLoading) => {
      if (!active || requestInProgress) return;
      requestInProgress = true;
      if (showLoading) setState({ status: 'loading', data: null, error: '', errorStatus: null });
      try {
        const data = await getPublicContent(path, stableQuery);
        if (active) setState({ status: 'success', data, error: '', errorStatus: null });
      } catch (error) {
        if (active) {
          setState((current) => ({
            status: 'error',
            data: showLoading ? null : current.data,
            error: error.message || 'Public content is temporarily unavailable.',
            errorStatus: error.status ?? null,
          }));
        }
      } finally {
        requestInProgress = false;
      }
    };

    void load(true);
    const interval = refreshIntervalMs > 0
      ? window.setInterval(() => { void load(false); }, refreshIntervalMs)
      : null;
    return () => {
      active = false;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [path, stableQuery, attempt, refreshIntervalMs]);

  return { ...state, retry };
}
