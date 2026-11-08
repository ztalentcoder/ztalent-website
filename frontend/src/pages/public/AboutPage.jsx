import { Link } from 'react-router-dom';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import { CallToAction, CardGrid, ContentSection, InfoCard, PageHero } from '../../components/public/PublicPage.jsx';
import { PageMetadata } from '../../components/public/PublicContentState.jsx';
import { usePublicCompany } from '../../context/PublicContentContext.jsx';
import styles from '../../components/public/PublicPage.module.css';

const values = [
  { title: 'Quality', description: 'We build things that last and work.' },
  { title: 'Honesty', description: 'We say what is possible and what is not.' },
  { title: 'Learning', description: 'We keep learning and teach what we learn.' },
  { title: 'Service', description: 'We exist to solve real problems.' },
];

export default function AboutPage() {
  const { company } = usePublicCompany();

  return (
    <main>
      <PageMetadata title="About" description={company?.description || company?.tagline} />
      <PageHero
        title={`About ${company?.name || 'Ztalent Coder'}`}
        description={company?.description || 'A young tech company that trains talent, builds solutions and works with data.'}
      />
      <ContentSection>
        <SectionHeading
          title="Local talent can solve local problems"
          description="Ztalent Coder started from a simple idea. We teach people to code, then use that talent to build systems and data solutions for communities and institutions. Our three pillars feed each other: Academic, Tech Solutions and Data & AI."
        />
        <CardGrid>
          <InfoCard title="Mission" description="Make technology skills and tools available to everyone." />
          <InfoCard title="Vision" description="A community that solves its own problems with technology and data." />
        </CardGrid>
        <p className={styles.meetTeam}><Link to="/team">Meet the team</Link></p>
      </ContentSection>
      <ContentSection soft>
        <SectionHeading title="Our values" />
        <CardGrid>
          {values.map(({ title, description }) => (
            <InfoCard key={title} title={title} description={description} />
          ))}
        </CardGrid>
      </ContentSection>
      <CallToAction />
    </main>
  );
}
