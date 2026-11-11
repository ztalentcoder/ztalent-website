import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import PublicImage from '../../components/public/PublicImage.jsx';
import { PublicContentState } from '../../components/public/PublicContentState.jsx';
import { ContentSection } from '../../components/public/PublicPage.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import styles from './CourseCatalogue.module.css';

const pageSize = 9;

function YouTubeIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
    </svg>
  );
}

function CourseCard({ course }) {
  return (
    <article className={styles.card}>
      <div className={styles.image}>
        <PublicImage
          src={course.imageUrl}
          alt=""
          fallback={<span className={styles.imageFallback} aria-hidden="true">Z</span>}
        />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.meta}>
          <span className={styles.category}>{course.category?.name}</span>
          <span className={styles.level}>{course.level.toLowerCase()}</span>
        </div>
        <h3>{course.title}</h3>
        <p className={styles.summary}>{course.summary || course.description}</p>
        <div className={styles.episodeCount}>
          {course.episodeCount} {course.episodeCount === 1 ? 'episode' : 'episodes'}
        </div>
        <div className={styles.actions}>
          <Link className={styles.viewMore} to={`/academic/courses/${encodeURIComponent(course.slug)}`}>
            View More
          </Link>
          {course.externalUrl && (
            <a
              className={styles.youtubeLink}
              href={course.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Watch ${course.title} on YouTube (opens in a new tab)`}
            >
              <YouTubeIcon />
              <span>Watch on YouTube</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CourseCatalogue() {
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [sort, setSort] = useState('displayOrder');
  const [page, setPage] = useState(1);
  const categories = usePublicContent('course-categories', { pageSize: 50 });
  const courses = usePublicContent('academic-courses', {
    page,
    pageSize,
    ...(searchQuery ? { search: searchQuery } : {}),
    ...(category ? { category } : {}),
    ...(level ? { level } : {}),
    sort,
  });
  const items = courses.data?.items ?? [];
  const pagination = courses.data?.pagination;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(search.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  function updateFilter(setter) {
    return (event) => {
      setPage(1);
      setter(event.target.value);
    };
  }

  return (
    <ContentSection id="courses">
      <SectionHeading
        title="Explore Our Courses"
        description="Discover courses designed to help you develop practical technology skills and advance your knowledge."
      />
      <div className={styles.toolbar} role="search" aria-label="Search and filter courses">
        <label className={styles.search}>
          <span>Search courses</span>
          <input
            type="search"
            placeholder="Search by course title"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={updateFilter(setCategory)}>
            <option value="">All categories</option>
            {(categories.data?.items ?? []).map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Level</span>
          <select value={level} onChange={updateFilter(setLevel)}>
            <option value="">All levels</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select value={sort} onChange={updateFilter(setSort)}>
            <option value="displayOrder">Recommended</option>
            <option value="titleAsc">Title: A to Z</option>
            <option value="titleDesc">Title: Z to A</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>
      {categories.status === 'error' && (
        <div className={styles.categoryError} role="alert">
          <span>Course categories could not be loaded.</span>
          <button type="button" onClick={categories.retry}>Retry</button>
        </div>
      )}
      {courses.status === 'loading' ? (
        <PublicContentState status="loading" />
      ) : courses.status === 'error' ? (
        <PublicContentState status="error" error={courses.error} retry={courses.retry} />
      ) : items.length === 0 ? (
        <PublicContentState
          status="success"
          empty={searchQuery || category || level
            ? 'No courses match your search and filters. Try changing your selection.'
            : 'There are no published courses yet. Check back soon.'}
        />
      ) : (
        <>
          <div className={styles.grid} aria-label="Course results" aria-live="polite">
            {items.map((course) => <CourseCard key={course.slug} course={course} />)}
          </div>
          {pagination?.pageCount > 1 && (
            <nav className={styles.pagination} aria-label="Course pages">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <span>Page {page} of {pagination.pageCount}</span>
              <button type="button" disabled={page >= pagination.pageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
            </nav>
          )}
        </>
      )}
    </ContentSection>
  );
}
