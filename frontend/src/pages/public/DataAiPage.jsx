import SectionHeading from '../../components/common/SectionHeading.jsx';
import { CallToAction, CardGrid, ContentSection, InfoCard, PageHero } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import styles from '../../components/public/PublicPage.module.css';

const dataSteps = ['Data sources', 'Collection', 'Cleaning', 'Storage', 'Dashboards and reports'];

export default function DataAiPage() {
  const services = usePublicContent('services', { pageSize: 20 });
  const items = services.data?.items ?? [];

  return (
    <main>
      <PageMetadata title="Data & AI" description="Published data and artificial intelligence services." />
      <PageHero title="Data & AI" description="Collect it, clean it, understand it and use it." />
      <ContentSection>
        <SectionHeading title="Our services" description="Published services from our business areas." />
        {items.length > 0 ? (
          <CardGrid>
            {items.map((service) => (
              <InfoCard
                key={`${service.businessArea?.slug || 'service'}-${service.slug}`}
                eyebrow={service.businessArea?.name}
                title={service.title}
                description={service.summary || service.description}
              />
            ))}
          </CardGrid>
        ) : (
          <PublicContentState
            status={services.status}
            error={services.error}
            retry={services.retry}
            empty="There are no published services yet."
          />
        )}
      </ContentSection>
      <ContentSection soft>
        <SectionHeading title="From raw data to decisions" />
        <div className={styles.flow} role="list" aria-label="Data process">
          {dataSteps.map((step, index) => (
            <span className={styles.flowStep} key={step} role="listitem">
              {index > 0 && <b aria-hidden="true">→</b>}
              {step}
            </span>
          ))}
        </div>
      </ContentSection>
      <CallToAction
        title="Got data and not sure where to start?"
        description="We will assess your data and tell you what is possible."
        buttonLabel="Request a data service"
      />
    </main>
  );
}
