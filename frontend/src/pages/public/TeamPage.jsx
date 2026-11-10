import SectionHeading from '../../components/common/SectionHeading.jsx';
import PublicImage from '../../components/public/PublicImage.jsx';
import { CallToAction, ContentSection, PageHero } from '../../components/public/PublicPage.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import styles from './TeamPage.module.css';

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
          <div className={styles.grid}>
            {members.map((member) => (
              <article className={styles.card} key={`${member.name}-${member.role}`}>
                <div className={styles.photoFrame}>
                  <PublicImage
                    className={styles.teamPhoto}
                    src={member.photoUrl}
                    alt={member.name}
                    style={{ '--team-photo-position': `${member.photoPosition ?? 35}%` }}
                  />
                </div>
                <h2 className={styles.name}>{member.name}</h2>
                <p className={styles.role}>{member.role}</p>
                {member.portfolioUrl && (
                  <a className={styles.portfolioLink} href={member.portfolioUrl} target="_blank" rel="noreferrer">
                    View Portfolio
                  </a>
                )}
              </article>
            ))}
          </div>
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
