import { useDeferredValue, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Image as ImageIcon, Search } from 'lucide-react';
import PublicImage from '../../components/public/PublicImage.jsx';
import { CallToAction, ContentSection, PageHero, styles } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import blogStyles from './BlogPage.module.css';

const PAGE_SIZE = 9;

function getPositivePage(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function postMetadata(post) {
  return [
    post.author,
    formatDate(post.publishedAt),
    post.readingTimeMinutes ? `${post.readingTimeMinutes} min read` : '',
  ].filter(Boolean);
}

export default function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchValue = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(searchValue);
  const deferredSearch = useDeferredValue(searchValue);
  const category = searchParams.get('category') || '';
  const page = getPositivePage(searchParams.get('page'));
  const posts = usePublicContent('blog-posts', {
    page,
    pageSize: PAGE_SIZE,
    ...(category ? { category } : {}),
    ...(deferredSearch ? { search: deferredSearch } : {}),
  });
  const categories = usePublicContent('blog-categories', { pageSize: 50 });
  const items = posts.data?.items ?? [];
  const pagination = posts.data?.pagination;

  useEffect(() => {
    setSearchInput(searchValue);
  }, [searchValue]);

  useEffect(() => {
    const rawPage = searchParams.get('page');
    if (rawPage && (!/^[1-9]\d*$/.test(rawPage) || getPositivePage(rawPage) !== Number(rawPage))) {
      updateFilters({ page: page === 1 ? '' : page }, true);
    }
    if (posts.status === 'success' && pagination?.pageCount && page > pagination.pageCount) {
      updateFilters({ page: pagination.pageCount === 1 ? '' : pagination.pageCount }, true);
    }
  }, [page, searchParams, posts.status, pagination?.pageCount]);

  function updateFilters(nextValues, replace = false) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(nextValues)) {
      if (value) next.set(key, String(value));
      else next.delete(key);
    }
    setSearchParams(next, { replace });
  }

  function submitSearch(event) {
    event.preventDefault();
    updateFilters({ search: searchInput.trim(), page: '' });
  }

  function changeCategory(value) {
    updateFilters({ category: value, page: '' });
  }

  function changePage(nextPage) {
    updateFilters({ page: nextPage === 1 ? '' : nextPage });
    document.getElementById('latest-articles')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main>
      <PageMetadata title="Blog" description="Read the latest articles on technology, data, AI, and digital innovation from Ztalent Coder." />
      <PageHero title="Blog" description="Ideas, insights, and practical perspectives on technology, data, and innovation." />

      <ContentSection id="latest-articles">
        <div className={blogStyles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>From our team</p>
            <h2>Latest Articles</h2>
            <p>Explore perspectives and ideas from the people building with technology.</p>
          </div>
        </div>

        <form className={blogStyles.searchForm} role="search" onSubmit={submitSearch}>
          <label htmlFor="blog-search">Search articles</label>
          <div className={blogStyles.searchControl}>
            <Search aria-hidden="true" size={19} />
            <input
              id="blog-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by topic or keyword"
            />
            <button type="submit">Search</button>
          </div>
        </form>

        {categories.status === 'error'
          ? <PublicContentState status={categories.status} error={categories.error} retry={categories.retry} />
          : (
            <div className={blogStyles.categories} role="group" aria-label="Filter articles by category">
              <button
                type="button"
                aria-pressed={!category}
                className={!category ? blogStyles.activeCategory : ''}
                onClick={() => changeCategory('')}
              >All articles</button>
              {(categories.data?.items ?? []).map((item) => (
                <button
                  type="button"
                  key={item.slug}
                  aria-pressed={category === item.slug}
                  className={category === item.slug ? blogStyles.activeCategory : ''}
                  onClick={() => changeCategory(item.slug)}
                >
                  {item.name}
                  {Number.isFinite(item.postCount) && <span>{item.postCount}</span>}
                </button>
              ))}
            </div>
          )}

        {items.length > 0 ? (
          <>
            <div className={blogStyles.articleList}>
              {items.map((post) => {
                const metadata = postMetadata(post);
                return (
                  <article className={blogStyles.articleCard} key={post.slug}>
                    <Link className={blogStyles.cardImage} to={`/blog/${post.slug}`} aria-label={`Read ${post.title}`}>
                      <PublicImage
                        src={post.coverImageUrl}
                        alt={post.coverImageAlt || post.title}
                        fallback={(
                          <div className={blogStyles.imageFallback} role="img" aria-label="Article cover image unavailable">
                            <ImageIcon aria-hidden="true" size={32} />
                          </div>
                        )}
                      />
                    </Link>
                    <div className={blogStyles.articleDetails}>
                      {post.category?.name && <p className={blogStyles.articleCategory}>{post.category.name}</p>}
                      <h3 className={blogStyles.articleTitle}>
                        <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                      </h3>
                      {post.excerpt && <p className={blogStyles.articleExcerpt}>{post.excerpt}</p>}
                      {metadata.length > 0 && (
                        <p className={blogStyles.cardMetadata}>{metadata.join(' · ')}</p>
                      )}
                      <Link className={blogStyles.readLink} to={`/blog/${post.slug}`}>
                        Read Article <ArrowRight aria-hidden="true" size={16} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
            {posts.status === 'error' && (
              <PublicContentState status={posts.status} error={posts.error} retry={posts.retry} />
            )}
            {pagination?.pageCount > 1 && (
              <nav className={blogStyles.pagination} aria-label="Article pagination">
                <button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
                <span aria-live="polite">Page {page} of {pagination.pageCount}</span>
                <button type="button" disabled={page >= pagination.pageCount} onClick={() => changePage(page + 1)}>Next</button>
              </nav>
            )}
          </>
        ) : (
          <PublicContentState
            status={posts.status}
            error={posts.error}
            retry={posts.retry}
            empty={deferredSearch || category
              ? 'No articles match your search and category. Try changing your filters.'
              : 'There are no published articles yet.'}
          />
        )}
      </ContentSection>

      <CallToAction
        title="Have a story or idea to discuss?"
        description="Get in touch with our team and let’s explore what we can create together."
        buttonLabel="Contact Us"
      />
    </main>
  );
}
