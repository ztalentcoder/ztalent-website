import { Link, useParams } from 'react-router-dom';
import PublicImage from '../../components/public/PublicImage.jsx';
import { ContentSection, PageHero, styles } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';

const details = {
  project: { resource: 'projects', label: 'Project', list: '/portfolio' },
  article: { resource: 'blog-posts', label: 'Article', list: '/blog' },
  course: { resource: 'academic-courses', label: 'Course', list: '/academic' },
};

export default function PublicContentDetailPage({ type }) {
  const { slug = '' } = useParams();
  const detail = details[type];
  const content = usePublicContent(`${detail.resource}/${encodeURIComponent(slug)}`);
  const item = content.data?.item;

  if (content.status === 'error') {
    const notFound = content.errorStatus === 404;
    return (
      <main>
        <PageMetadata title={notFound ? `${detail.label} not found` : detail.label} />
        <PageHero title={notFound ? `${detail.label} not found` : 'Content unavailable'} description="" />
        <ContentSection>
          {notFound
            ? <p className={styles.contentState}>This published content is unavailable.</p>
            : <PublicContentState status={content.status} error={content.error} retry={content.retry} />}
          <p><Link to={detail.list}>Return to {detail.list === '/blog' ? 'the blog' : detail.list === '/academic' ? 'courses' : 'the portfolio'}</Link></p>
        </ContentSection>
      </main>
    );
  }

  if (!item) {
    return (
      <main>
        <PageMetadata title={detail.label} />
        <PageHero title="Loading content" description="" />
        <ContentSection><PublicContentState status={content.status} error={content.error} retry={content.retry} /></ContentSection>
      </main>
    );
  }

  const description = item.summary || item.excerpt || item.description || '';
  return (
    <main>
      <PageMetadata title={item.title} description={description} />
      <PageHero title={item.title} description={description} />
      <ContentSection>
        <PublicImage className={styles.contentImage} src={item.coverImageUrl} alt={item.title} />
        <PublicImage className={styles.contentImage} src={item.imageUrl} alt={item.title} />
        {item.category && <p className={styles.eyebrow}>{item.category.name}</p>}
        {item.businessArea && <p className={styles.eyebrow}>{item.businessArea.name}</p>}
        {item.level && <p className={styles.eyebrow}>{item.level.toLowerCase()}</p>}
        {(item.body || item.description) && <div className={styles.articleBody}>{item.body || item.description}</div>}
        {item.externalUrl && (
          <p><a className={styles.textLink} href={item.externalUrl} target="_blank" rel="noreferrer">Open course</a></p>
        )}
        {item.publishedAt && <p className={styles.contentDate}>Published {new Date(item.publishedAt).toLocaleDateString()}</p>}
        <p><Link to={detail.list}>Back to {detail.list === '/blog' ? 'the blog' : detail.list === '/academic' ? 'courses' : 'the portfolio'}</Link></p>
      </ContentSection>
    </main>
  );
}
