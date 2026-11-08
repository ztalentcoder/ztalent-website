import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/common/Button.jsx';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import { CardGrid, ContentSection, InfoCard, PageHero } from '../../components/public/PublicPage.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import styles from '../../components/public/PublicPage.module.css';

export default function AcademicPage() {
  const [page, setPage] = useState(1);
  const courses = usePublicContent('academic-courses', { page, pageSize: 9 });
  const items = courses.data?.items ?? [];
  const pagination = courses.data?.pagination;

  return (
    <main>
      <PageMetadata title="Academic" description="Published coding, technology and data courses." />
      <PageHero title="Academic" description="Learn to code and work with data. Every course is free on our YouTube channel." />
      <ContentSection id="courses">
        <SectionHeading title="Courses" description="Pick a course and start watching." />
        {items.length > 0 ? (
          <>
            <CardGrid>
              {items.map((course) => (
                <InfoCard
                  key={course.slug}
                  eyebrow={course.level.toLowerCase()}
                  title={course.title}
                  description={[
                    course.summary,
                    course.episodeCount === null ? null : `${course.episodeCount} episodes`,
                    course.language,
                  ].filter(Boolean).join(' · ') || 'Explore this published course.'}
                  footer={(
                    <>
                      <Link to={`/academic/${course.slug}`}>Course details</Link>
                      {' · '}
                      <a href={course.externalUrl} target="_blank" rel="noreferrer">Open course</a>
                    </>
                  )}
                />
              ))}
            </CardGrid>
            {pagination?.pageCount > 1 && (
              <nav className={styles.filters} aria-label="Course pages">
                <button className={styles.filter} type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <span>Page {page} of {pagination.pageCount}</span>
                <button className={styles.filter} type="button" disabled={page >= pagination.pageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
              </nav>
            )}
          </>
        ) : (
          <PublicContentState
            status={courses.status}
            error={courses.error}
            retry={courses.retry}
            empty="There are no published courses yet. Check back soon."
          />
        )}
      </ContentSection>
      <ContentSection soft>
        <div className={styles.subscribe}>
          <div>
            <h2>New episodes every week</h2>
            <p>Subscribe on YouTube so you never miss a lesson.</p>
          </div>
          <Button href="https://youtube.com/" target="_blank" rel="noreferrer">Subscribe on YouTube</Button>
        </div>
      </ContentSection>
    </main>
  );
}
