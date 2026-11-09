import SectionHeading from '../../components/common/SectionHeading.jsx';
import PublicImage from '../../components/public/PublicImage.jsx';
import { CallToAction, CardGrid, ContentSection, PageHero, styles } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';

export default function TeamPage() {
  const team = usePublicContent('team-members', { pageSize: 50 });
  const members = team.data?.items ?? [];

  return (
    <main>
      <PageMetadata title="Our Team" description="Meet the published team members at Ztalent Coder." />
      <PageHero title="Our Team" description="The people behind Ztalent Coder." />
      <ContentSection>
        <SectionHeading title="Meet the team" />
        {members.length > 0 ? (
          <CardGrid>
            {members.map((member) => (
              <article className={`${styles.card} ${styles.centeredCard}`} key={`${member.name}-${member.role}`}>
                <PublicImage
                  className={styles.teamPhoto}
                  src={member.photoUrl}
                  alt={member.name}
                />
                <h3>{member.name}</h3>
                <p>{member.role}</p>
                {member.portfolioUrl && (
                  <a className={styles.portfolioLink} href={member.portfolioUrl} target="_blank" rel="noreferrer">
                    View Portfolio
                  </a>
                )}
              </article>
            ))}
          </CardGrid>
        ) : (
          <PublicContentState
            status={team.status}
            error={team.error}
            retry={team.retry}
            empty="Team profiles will appear here when published."
          />
        )}
      </ContentSection>
      <CallToAction />
    </main>
  );
}
