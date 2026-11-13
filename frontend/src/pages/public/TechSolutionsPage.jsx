import Button from '../../components/common/Button.jsx';
import ServiceIcon from '../../components/common/ServiceIcon.jsx';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import { ContentSection, PageHero } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import styles from './TechSolutionsPage.module.css';

export default function TechSolutionsPage() {
  const services = usePublicContent('services', { pageSize: 50, businessArea: 'tech-solutions' });
  const serviceItems = services.data?.items ?? [];
  const status = services.status === 'error'
    ? 'error'
    : services.status === 'loading'
      ? 'loading'
      : 'success';

  return (
    <main>
      <PageMetadata title="Tech Solutions" description="Custom software and technology services by Ztalent Coder." />
      <PageHero title="Tech Solutions" description="Our own solutions for the community, and custom systems built for your institution." />
      <ContentSection id="services">
        <SectionHeading
          title="Our Expertise"
          description="We design and deliver innovative technology solutions that help businesses and organizations grow, operate efficiently, and achieve their goals."
        />
        {status === 'success' && serviceItems.length > 0 ? (
          <div className={styles.serviceGrid}>
            {serviceItems.map((service) => (
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
            status={status}
            error={services.error}
            retry={services.retry}
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
    </main>
  );
}
