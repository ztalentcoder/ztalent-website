import { useCallback, useEffect, useRef, useState } from 'react';

export default function useAutoDismissNotice(duration = 3000) {
  const [notice, setNoticeState] = useState({ message: '', version: 0 });
  const version = useRef(0);

  const setNotice = useCallback((message) => {
    version.current += 1;
    setNoticeState({ message, version: version.current });
  }, []);

  useEffect(() => {
    if (!notice.message) return undefined;
    const timer = window.setTimeout(() => {
      setNoticeState((current) => (
        current.version === notice.version
          ? { message: '', version: current.version }
          : current
      ));
    }, duration);
    return () => window.clearTimeout(timer);
  }, [duration, notice]);

  return [notice.message, setNotice];
}
