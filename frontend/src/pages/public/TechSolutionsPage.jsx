import Button from '../../components/common/Button.jsx';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import { CallToAction, CardGrid, ContentSection, InfoCard, PageHero } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import styles from '../../components/public/PublicPage.module.css';

const systemTypes = [
  'Management information systems (MIS)',
  'School, hospital and inventory systems',
  'Finance and HR systems',
  'Websites and mobile apps',
];

export default function TechSolutionsPage() {
  const areas = usePublicContent('business-areas', { pageSize: 20 });
  const items = areas.data?.items ?? [];

  return (
    <main>
      <PageMetadata title="Tech Solutions" description="Published business areas and technology solutions." />
      <PageHero title="Tech Solutions" description="Our own solutions for the community, and custom systems built for your institution." />
      <ContentSection id="business-areas">
        <SectionHeading title="Business areas" description="Explore our published areas of work." />
        {items.length > 0 ? (
          <CardGrid>
            {items.map((area) => (
              <InfoCard key={area.slug} title={area.name} description={area.summary || area.description} />
            ))}
          </CardGrid>
        ) : (
          <PublicContentState
            status={areas.status}
            error={areas.error}
            retry={areas.retry}
            empty="There are no published business areas yet."
          />
        )}
      </ContentSection>
      <ContentSection soft>
        <div className={styles.split}>
          <div>
            <h2 className={styles.contentTitle}>Custom systems for your institution</h2>
            <p className={styles.intro}>Tell us the problem. We consult, design, build, test, launch and support.</p>
            <ul className={styles.checklist}>
              {systemTypes.map((system) => <li key={system}>{system}</li>)}
            </ul>
            <Button to="/contact">Request a system</Button>
          </div>
        </div>
      </ContentSection>
      <CallToAction />
    </main>
  );
}
