import Button from '../../components/common/Button.jsx';
import ServiceIcon from '../../components/common/ServiceIcon.jsx';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import { CallToAction, ContentSection, PageHero } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import styles from './TechSolutionsPage.module.css';

export default function TechSolutionsPage() {
  const areas = usePublicContent('business-areas', { pageSize: 50 });
  const services = usePublicContent('services', { pageSize: 50 });
  const categories = areas.data?.items ?? [];
  const serviceItems = services.data?.items ?? [];
  const status = areas.status === 'error' || services.status === 'error'
    ? 'error'
    : areas.status === 'loading' || services.status === 'loading'
      ? 'loading'
      : 'success';
  const retry = () => {
    areas.retry();
    services.retry();
  };
  const groupedServices = categories.map((category) => ({
    ...category,
    services: serviceItems.filter((service) => service.businessArea?.slug === category.slug),
  })).filter((category) => category.services.length > 0);

  return (
    <main>
      <PageMetadata title="Tech Solutions" description="Custom software and technology services by Ztalent Coder." />
      <PageHero title="Tech Solutions" description="Our own solutions for the community, and custom systems built for your institution." />
      <ContentSection id="services">
        <SectionHeading title="Services" description="Thoughtful technology services built around the needs of your organization." />
        {status === 'success' && groupedServices.length > 0 ? (
          <div className={styles.categoryList}>
            {groupedServices.map((category) => (
              <section className={styles.category} key={category.slug} aria-labelledby={`category-${category.slug}`}>
                <header className={styles.categoryHeader}>
                  <h2 id={`category-${category.slug}`}>{category.name}</h2>
                  {category.summary && <p>{category.summary}</p>}
                </header>
                <div className={styles.serviceGrid}>
                  {category.services.map((service) => (
                    <article className={styles.serviceCard} key={`${category.slug}-${service.slug}`}>
                      <span className={styles.iconFrame}>
                        <ServiceIcon name={service.icon} />
                      </span>
                      <div className={styles.cardContent}>
                        <h3>{service.title}</h3>
                        <p>{service.summary || service.description}</p>
                        {service.keyFeatures?.length > 0 && (
                          <ul className={styles.featureList}>
                            {service.keyFeatures.map((feature, index) => <li key={`${index}-${feature}`}>{feature}</li>)}
                          </ul>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <PublicContentState
            status={status}
            error={areas.error || services.error}
            retry={retry}
            empty="There are no published services yet. Check back soon."
          />
        )}
      </ContentSection>
      <ContentSection soft>
        <div className={styles.contactCallout}>
          <div>
            <h2>Custom systems for your institution</h2>
            <p>Tell us the problem. We consult, design, build, test, launch and support.</p>
          </div>
          <Button to="/contact">Request a system</Button>
        </div>
      </ContentSection>
      <CallToAction />
    </main>
  );
}
