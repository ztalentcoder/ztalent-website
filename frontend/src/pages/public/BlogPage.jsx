import { useState } from 'react';
import { Link } from 'react-router-dom';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import PublicImage from '../../components/public/PublicImage.jsx';
import { CardGrid, ContentSection, InfoCard, PageHero, styles } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';

export default function BlogPage() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const posts = usePublicContent('blog-posts', { page, pageSize: 9, ...(category ? { category } : {}) });
  const categories = usePublicContent('blog-categories', { pageSize: 50 });
  const items = posts.data?.items ?? [];
  const pagination = posts.data?.pagination;

  return (
    <main>
      <PageMetadata title="Blog" description="Published articles on technology, data and AI." />
      <PageHero title="Blog" description="Articles on technology, data and AI." />
      <ContentSection id="latest-articles">
        <SectionHeading title="Latest articles" />
        {(categories.data?.items?.length ?? 0) > 0 && (
          <div className={styles.filters} role="group" aria-label="Filter articles">
            {[{ slug: '', name: 'All' }, ...categories.data.items].map((item) => (
              <button
                aria-pressed={category === item.slug}
                className={`${styles.filter}${category === item.slug ? ` ${styles.filterActive}` : ''}`}
                key={item.slug || 'all'}
                onClick={() => { setCategory(item.slug); setPage(1); }}
                type="button"
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
        {items.length > 0 ? (
          <>
            <CardGrid>
              {items.map((post) => (
                <InfoCard
                  key={post.slug}
                  eyebrow={post.category.name}
                  title={post.title}
                  description={post.excerpt || ''}
                  footer={<Link to={`/blog/${post.slug}`}>Read article</Link>}
                >
                  <PublicImage className={styles.contentImage} src={post.coverImageUrl} alt={post.title} />
                </InfoCard>
              ))}
            </CardGrid>
            {pagination?.pageCount > 1 && (
              <div className={styles.filters} aria-label="Article pages">
                <button className={styles.filter} type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <span>Page {page} of {pagination.pageCount}</span>
                <button className={styles.filter} type="button" disabled={page >= pagination.pageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            )}
          </>
        ) : (
          <PublicContentState
            status={posts.status}
            error={posts.error}
            retry={posts.retry}
            empty="There are no published articles yet."
          />
        )}
      </ContentSection>
    </main>
  );
}
