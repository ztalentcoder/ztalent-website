import { useEffect } from 'react';
import styles from './PublicPage.module.css';

export function PublicContentState({ status, error, retry, empty = 'There is no published content to show yet.' }) {
  if (status === 'loading') {
    return <p className={styles.contentState} role="status">Loading content…</p>;
  }
  if (status === 'error') {
    return (
      <div className={styles.contentState} role="alert">
        <p>{error}</p>
        {retry && <button className={styles.retryButton} type="button" onClick={retry}>Try again</button>}
      </div>
    );
  }
  return <p className={styles.contentState}>{empty}</p>;
}

export function PageMetadata({ title, description }) {
  useEffect(() => {
    document.title = title ? `${title} | Ztalent Coder` : 'Ztalent Coder | Tech Company Solutions';
    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement('meta');
      descriptionTag.name = 'description';
      document.head.append(descriptionTag);
    }
    descriptionTag.content = description || 'Ztalent Coder teaches talent, builds solutions and turns data into decisions.';

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = `${window.location.origin}${window.location.pathname}`;
  }, [title, description]);
  return null;
}
