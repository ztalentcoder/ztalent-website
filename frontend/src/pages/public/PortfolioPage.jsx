import { useState } from 'react';
import { Link } from 'react-router-dom';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import PublicImage from '../../components/public/PublicImage.jsx';
import { CallToAction, CardGrid, ContentSection, InfoCard, PageHero, styles } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';

export default function PortfolioPage() {
  const [businessArea, setBusinessArea] = useState('');
  const [page, setPage] = useState(1);
  const projects = usePublicContent('projects', { page, pageSize: 9, ...(businessArea ? { businessArea } : {}) });
  const areas = usePublicContent('business-areas', { pageSize: 50 });
  const testimonials = usePublicContent('testimonials', { pageSize: 6 });
  const items = projects.data?.items ?? [];
  const publishedTestimonials = testimonials.data?.items ?? [];
  const pagination = projects.data?.pagination;

  return (
    <main>
      <PageMetadata title="Portfolio" description="Published projects and case studies." />
      <PageHero title="Portfolio" description="Selected projects and case studies." />
      <ContentSection id="our-work">
        <SectionHeading title="Our work" description="Published projects and case studies." />
        {(areas.data?.items?.length ?? 0) > 0 && (
          <div className={styles.filters} role="group" aria-label="Filter projects">
            {[{ slug: '', name: 'All' }, ...areas.data.items].map((area) => (
              <button
                aria-pressed={businessArea === area.slug}
                className={`${styles.filter}${businessArea === area.slug ? ` ${styles.filterActive}` : ''}`}
                key={area.slug || 'all'}
                onClick={() => { setBusinessArea(area.slug); setPage(1); }}
                type="button"
              >
                {area.name}
              </button>
            ))}
          </div>
        )}
        {items.length > 0 ? (
          <>
            <CardGrid>
              {items.map((project) => (
                <InfoCard
                  key={project.slug}
                  eyebrow={project.businessArea?.name}
                  title={project.title}
                  description={project.summary}
                  footer={<Link to={`/portfolio/${project.slug}`}>View project</Link>}
                >
                  <PublicImage className={styles.contentImage} src={project.imageUrl} alt={project.title} />
                </InfoCard>
              ))}
            </CardGrid>
            {pagination?.pageCount > 1 && (
              <div className={styles.filters} aria-label="Project pages">
                <button className={styles.filter} type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <span>Page {page} of {pagination.pageCount}</span>
                <button className={styles.filter} type="button" disabled={page >= pagination.pageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            )}
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
                  className={styles.quoteCard}
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
      <CallToAction />
    </main>
  );
}
