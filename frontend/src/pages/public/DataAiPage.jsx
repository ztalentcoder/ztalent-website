import SectionHeading from '../../components/common/SectionHeading.jsx';
import ServiceIcon from '../../components/common/ServiceIcon.jsx';
import { CallToAction, ContentSection, PageHero } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import styles from './TechSolutionsPage.module.css';

export default function DataAiPage() {
  const services = usePublicContent('services', { pageSize: 50, businessArea: 'data-ai' });
  const items = services.data?.items ?? [];

  return (
    <main>
      <PageMetadata title="Data & AI" description="Published data and artificial intelligence services." />
      <PageHero title="Data & AI" description="Collect it, clean it, understand it and use it." />
      <ContentSection>
        <SectionHeading
          title="Driving Innovation with Data & AI"
          description="We help organizations unlock the value of data through engineering, analytics, visualization, and artificial intelligence."
        />
        {items.length > 0 ? (
          <div className={styles.serviceGrid}>
            {items.map((service) => (
              <article className={styles.serviceCard} key={service.slug}>
                <span className={styles.iconFrame}>
                  <ServiceIcon name={service.icon} />
                </span>
                <div className={styles.cardContent}>
                  <h3>{service.title}</h3>
                  <p>{service.summary || service.description}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <PublicContentState
            status={services.status}
            error={services.error}
            retry={services.retry}
            empty="There are no published services yet."
          />
        )}
      </ContentSection>
      <CallToAction
        title="Got data and not sure where to start?"
        description="We will assess your data and tell you what is possible."
        buttonLabel="Request a data service"
      />
    </main>
  );
}
