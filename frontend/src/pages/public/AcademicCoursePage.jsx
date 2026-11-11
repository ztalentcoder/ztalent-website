import { Link, useParams } from 'react-router-dom';
import PublicImage from '../../components/public/PublicImage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import { ContentSection, PageHero } from '../../components/public/PublicPage.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import styles from './AcademicCoursePage.module.css';

function YouTubeIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
    </svg>
  );
}

export default function AcademicCoursePage() {
  const { slug = '' } = useParams();
  const content = usePublicContent(`academic-courses/${encodeURIComponent(slug)}`);
  const course = content.data?.item;

  if (content.status === 'error') {
    const notFound = content.errorStatus === 404;
    return (
      <main>
        <PageMetadata title={notFound ? 'Course not found' : 'Course unavailable'} />
        <PageHero
          title={notFound ? 'Course not found' : 'Course unavailable'}
          description={notFound ? 'This published course is unavailable.' : ''}
        />
        <ContentSection>
          {!notFound && (
            <PublicContentState status={content.status} error={content.error} retry={content.retry} />
          )}
          <p className={styles.returnLink}><Link to="/academic">Return to courses</Link></p>
        </ContentSection>
      </main>
    );
  }

  if (!course) {
    return (
      <main>
        <PageMetadata title="Course" />
        <PageHero title="Loading course" description="" />
        <ContentSection><PublicContentState status={content.status} error={content.error} retry={content.retry} /></ContentSection>
      </main>
    );
  }

  const learningOutcomes = course.learningOutcomes ?? [];
  const requirements = course.requirements ?? [];
  const episodes = course.episodes ?? [];

  return (
    <main>
      <PageMetadata title={course.title} description={course.summary || course.description} />
      <PageHero title={course.title} description={course.summary || ''} eyebrow="Course details" />
      <ContentSection>
        <div className={styles.details}>
          <div className={styles.media}>
            <PublicImage
              src={course.imageUrl}
              alt={`${course.title} course`}
              fallback={<div className={styles.imageFallback} aria-hidden="true">Course image</div>}
              loading="eager"
            />
          </div>
          <div className={styles.courseInfo}>
            <div className={styles.tags}>
              {course.category && <span>{course.category.name}</span>}
              <span>{course.level.toLowerCase()}</span>
              <span>{course.episodeCount} {course.episodeCount === 1 ? 'episode' : 'episodes'}</span>
            </div>
            <p className={styles.description}>{course.description || course.summary}</p>
            {course.externalUrl && (
              <a className={styles.youtubeLink} href={course.externalUrl} target="_blank" rel="noopener noreferrer">
                <YouTubeIcon />
                <span>Watch on YouTube (opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>
        <div className={styles.learningGrid}>
          {learningOutcomes.length > 0 && (
            <section className={styles.infoCard} aria-labelledby="course-learning">
              <h2 id="course-learning">What You Will Learn</h2>
              <ul>{learningOutcomes.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
            </section>
          )}
          {requirements.length > 0 && (
            <section className={styles.infoCard} aria-labelledby="course-requirements">
              <h2 id="course-requirements">Course Requirements</h2>
              <ul>{requirements.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
            </section>
          )}
        </div>
        <section className={styles.episodes} aria-labelledby="course-episodes">
          <div className={styles.episodeHeading}>
            <div>
              <p className={styles.eyebrow}>Course playlist</p>
              <h2 id="course-episodes">Episodes</h2>
            </div>
            <span>{episodes.length} {episodes.length === 1 ? 'episode' : 'episodes'}</span>
          </div>
          {episodes.length > 0 ? (
            <ol className={styles.episodeList}>
              {episodes.map((episode) => (
                <li className={styles.episode} key={`${episode.number}-${episode.title}`}>
                  <span className={styles.episodeNumber}>{String(episode.number).padStart(2, '0')}</span>
                  <div className={styles.episodeInfo}>
                    <h3>{episode.title}</h3>
                    {episode.summary && <p>{episode.summary}</p>}
                  </div>
                  <a
                    className={styles.episodeLink}
                    href={episode.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Watch episode ${episode.number}: ${episode.title} on YouTube (opens in a new tab)`}
                  >
                    <YouTubeIcon />
                    <span>Watch Episode</span>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.noEpisodes}>Episodes for this course are coming soon.</p>
          )}
        </section>
        <p className={styles.returnLink}><Link to="/academic">Back to all courses</Link></p>
      </ContentSection>
    </main>
  );
}
