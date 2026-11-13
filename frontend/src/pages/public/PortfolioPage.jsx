import { useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import PublicImage from '../../components/public/PublicImage.jsx';
import { CallToAction, CardGrid, ContentSection, InfoCard, PageHero, styles as sharedStyles } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import styles from './PortfolioPage.module.css';

const PAGE_SIZE = 6;
const MAX_PAGE = 1_000_000;

function parsePage(value) {
  if (value === null) return 1;
  if (!/^[1-9]\d*$/.test(value)) return null;

  const page = Number(value);
  return Number.isSafeInteger(page) && page <= MAX_PAGE ? page : null;
}

function getVisiblePages(page, pageCount) {
  const first = Math.max(1, page - 2);
  const last = Math.min(pageCount, page + 2);
  const pages = [];

  if (first > 1) {
    pages.push(1);
    if (first > 2) pages.push('start-gap');
  }
  for (let number = first; number <= last; number += 1) pages.push(number);
  if (last < pageCount) {
    if (last < pageCount - 1) pages.push('end-gap');
    pages.push(pageCount);
  }

  return pages;
}

function ProjectCard({ project, page }) {
  const detailUrl = `/portfolio/${encodeURIComponent(project.slug)}${page > 1 ? `?page=${page}` : ''}`;

  return (
    <article className={styles.projectCard}>
      <Link className={styles.projectLink} to={detailUrl}>
        <div className={styles.projectMedia}>
          <PublicImage
            className={styles.projectImage}
            src={project.imageUrl}
            alt={`${project.title} project`}
            fallback={(
              <div
                className={styles.imageFallback}
                role="img"
                aria-label={`${project.title} project cover image unavailable`}
              >
                <span className={styles.fallbackMark} aria-hidden="true">Z</span>
                <span>Project cover</span>
              </div>
            )}
          />
        </div>
        <div className={styles.projectContent}>
          {project.businessArea?.name && <p className={styles.projectType}>{project.businessArea.name}</p>}
          <h2>{project.title}</h2>
          <p className={styles.projectSummary}>{project.summary}</p>
          <span className={styles.projectAction}>
            View Project <ArrowRight aria-hidden="true" size={18} />
          </span>
        </div>
      </Link>
    </article>
  );
}

function Pagination({ page, pageCount, onPageChange }) {
  if (pageCount <= 1) return null;

  return (
    <nav className={styles.pagination} aria-label="Project pagination">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      <div className={styles.pageNumbers}>
        {getVisiblePages(page, pageCount).map((number) => (
          typeof number === 'string'
            ? <span className={styles.pageEllipsis} key={number} aria-hidden="true">…</span>
            : (
              <button
                type="button"
                key={number}
                aria-label={`Page ${number}`}
                aria-current={page === number ? 'page' : undefined}
                onClick={() => onPageChange(number)}
              >
                {number}
              </button>
            )
        ))}
      </div>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
        Next
      </button>
    </nav>
  );
}

export default function PortfolioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageValues = searchParams.getAll('page');
  const requestedPage = pageValues.length === 1 ? parsePage(pageValues[0]) : (pageValues.length === 0 ? 1 : null);
  const page = requestedPage ?? 1;
  const projects = usePublicContent('projects', { page, pageSize: PAGE_SIZE });
  const testimonials = usePublicContent('testimonials', { pageSize: 6 });
  const items = projects.data?.items ?? [];
  const publishedTestimonials = testimonials.data?.items ?? [];
  const pagination = projects.data?.pagination;

  const updatePage = useCallback((nextPage, { replace = false } = {}) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextPage <= 1) nextParams.delete('page');
    else nextParams.set('page', String(nextPage));

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace });
    }
  }, [searchParams, setSearchParams]);

  const canonicalPage = pageValues.length === 0
    ? page === 1
    : pageValues.length === 1 && page > 1 && pageValues[0] === String(page);

  useEffect(() => {
    if (!canonicalPage) updatePage(1, { replace: true });
  }, [canonicalPage, updatePage]);

  useEffect(() => {
    if (!pagination) return;
    const lastPage = Math.max(1, pagination.pageCount);
    if (page > lastPage) updatePage(lastPage, { replace: true });
  }, [page, pagination?.pageCount, updatePage]);

  return (
    <main>
      <PageMetadata
        title="Portfolio"
        description="A selection of published projects delivered by our team."
      />
      <PageHero
        title="Our Projects"
        description="A selection of published projects delivered by our team."
      />
      <ContentSection id="our-work">
        <SectionHeading
          title="Turning Ideas Into Impactful Solutions."
          description="Explore some of the projects we have designed, developed, and delivered through technology and innovation."
        />
        {items.length > 0 ? (
          <>
            <div className={styles.projectGrid}>
              {items.map((project) => <ProjectCard key={project.slug} project={project} page={page} />)}
            </div>
            <Pagination page={page} pageCount={pagination?.pageCount ?? 0} onPageChange={updatePage} />
          </>
        ) : (
          <PublicContentState
            status={projects.status}
            error={projects.error}
            retry={projects.retry}
            empty="There are no published projects yet."
          />
        )}
      </ContentSection>
      {(publishedTestimonials.length > 0 || testimonials.status === 'error') && (
        <ContentSection soft>
          <SectionHeading title="What clients say" />
          {publishedTestimonials.length > 0 ? (
            <CardGrid>
              {publishedTestimonials.map((testimonial, index) => (
                <InfoCard
                  className={sharedStyles.quoteCard}
                  key={`${testimonial.attributionName || 'client'}-${index}`}
                >
                  <blockquote>“{testimonial.quote}”</blockquote>
                  <cite>{[testimonial.attributionName, testimonial.attributionOrganization].filter(Boolean).join(', ')}</cite>
                </InfoCard>
              ))}
            </CardGrid>
          ) : <PublicContentState status={testimonials.status} error={testimonials.error} retry={testimonials.retry} />}
        </ContentSection>
      )}
      <CallToAction
        title="Have a Project in Mind?"
        description="Let's work together to turn your ideas into reality."
        buttonLabel="Contact Us"
      />
    </main>
  );
}
