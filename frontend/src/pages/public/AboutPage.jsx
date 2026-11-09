import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PrototypeIcon from '../../components/common/PrototypeIcon.jsx';
import { PageMetadata } from '../../components/public/PublicContentState.jsx';
import { PageHero } from '../../components/public/PublicPage.jsx';
import { getPublicContent } from '../../services/publicContentApi.js';
import styles from './AboutPage.module.css';

const sectionOrder = ['whoWeAre', 'story', 'missionVision', 'coreValues', 'philosophy', 'team'];

function paragraphs(content) {
  return content.split(/\n\s*\n/).map((text, index) => <p key={`${index}-${text.slice(0, 12)}`}>{text}</p>);
}

function SectionLabel({ children }) {
  return <p className={styles.label}>{children}</p>;
}

export default function AboutPage() {
  const [content, setContent] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    getPublicContent('about-page').then((response) => {
      if (active) {
        setContent(response.item ?? null);
        setStatus('success');
      }
    }).catch((requestError) => {
      if (active) {
        setError(requestError.message || 'About page content is temporarily unavailable.');
        setStatus('error');
      }
    });
    return () => { active = false; };
  }, [attempt]);

  if (status !== 'success' || !content || Object.keys(content).length === 0) {
    return (
      <main className={styles.statePage}>
        <PageMetadata title="About" description="Learn about Ztalent Coder, our purpose, values, and people." />
        {status === 'loading' ? (
          <p role="status">Loading About Ztalent Coder…</p>
        ) : status === 'error' ? (
          <div role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
          </div>
        ) : (
          <p>No About page content is available yet.</p>
        )}
      </main>
    );
  }

  const sections = Object.fromEntries(sectionOrder.map((key) => [key, content[key]]));
  const description = sections.whoWeAre?.body?.split('\n')[0];

  return (
    <main className={styles.aboutPage}>
      <PageMetadata title="About" description={description} />

      {sections.whoWeAre && (
        <>
          <PageHero
            eyebrow={sections.whoWeAre.label}
            title="Who We Are"
            style={{ order: sections.whoWeAre.displayOrder }}
          />
          <section className={styles.companyIntro} style={{ order: sections.whoWeAre.displayOrder }} aria-labelledby="about-title">
            <div className={styles.wrap}>
              <div className={styles.companyIntroContent}>
                <h2 id="about-title">{sections.whoWeAre.title}</h2>
                <div className={styles.introBody}>{paragraphs(sections.whoWeAre.body)}</div>
              </div>
            </div>
          </section>
        </>
      )}

      {sections.story && (
        <section className={styles.story} style={{ order: sections.story.displayOrder }} aria-labelledby="story-title">
          <div className={`${styles.wrap} ${styles.storyLayout}`}>
            <div className={styles.storyAside}>
              <span className={styles.storyIndex} aria-hidden="true">01</span>
              <SectionLabel>{sections.story.label}</SectionLabel>
              <p>{sections.story.subheading}</p>
            </div>
            <div className={styles.storyCopy}>
              <h2 id="story-title">{sections.story.title}</h2>
              {paragraphs(sections.story.body)}
            </div>
          </div>
        </section>
      )}

      {sections.missionVision && (
        <section className={styles.purpose} style={{ order: sections.missionVision.displayOrder }} aria-label="Our mission and vision">
          <div className={styles.wrap}>
            <div className={styles.purposeGrid}>
              <article className={styles.purposeCard}>
                <span className={styles.purposeIcon} aria-hidden="true"><PrototypeIcon name="solutions" /></span>
                <SectionLabel>{sections.missionVision.missionLabel}</SectionLabel>
                <h2>{sections.missionVision.missionTitle}</h2>
                <p>{sections.missionVision.missionDescription}</p>
              </article>
              <article className={`${styles.purposeCard} ${styles.visionCard}`}>
                <span className={styles.purposeIcon} aria-hidden="true"><PrototypeIcon name="academic" /></span>
                <SectionLabel>{sections.missionVision.visionLabel}</SectionLabel>
                <h2>{sections.missionVision.visionTitle}</h2>
                <p>{sections.missionVision.visionDescription}</p>
              </article>
            </div>
          </div>
        </section>
      )}

      {sections.coreValues && (
        <section className={styles.values} style={{ order: sections.coreValues.displayOrder }} aria-labelledby="values-title">
          <div className={styles.wrap}>
            <header className={styles.sectionHeader}>
              <SectionLabel>{sections.coreValues.label}</SectionLabel>
              <h2 id="values-title">{sections.coreValues.title}</h2>
              <p>{sections.coreValues.description}</p>
            </header>
            <div className={styles.valueGrid}>
              {sections.coreValues.values.map((value, index) => (
                <article className={styles.valueItem} key={`${value.title}-${index}`}>
                  <span className={styles.valueIcon}><PrototypeIcon name={value.icon} /></span>
                  <span className={styles.valueIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{value.title}</h3>
                  <p>{value.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {sections.philosophy && (
        <section className={styles.philosophy} style={{ order: sections.philosophy.displayOrder }} aria-labelledby="philosophy-title">
          <div className={styles.wrap}>
            <header className={styles.philosophyHeader}>
              <SectionLabel>{sections.philosophy.label}</SectionLabel>
              <h2 id="philosophy-title">{sections.philosophy.title}</h2>
              <div>{paragraphs(sections.philosophy.introduction)}</div>
            </header>
            <div className={styles.principleGrid}>
              {sections.philosophy.principles.map((principle, index) => (
                <article className={styles.principle} key={`${principle.title}-${index}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{principle.title}</h3>
                  <p>{principle.description}</p>
                </article>
              ))}
            </div>
            <p className={styles.philosophyClosing}>{sections.philosophy.closing}</p>
          </div>
        </section>
      )}

      {sections.team && (
        <section className={styles.team} style={{ order: sections.team.displayOrder }} aria-labelledby="team-title">
          <div className={`${styles.wrap} ${styles.teamInner}`}>
            <div>
              <SectionLabel>{sections.team.label}</SectionLabel>
              <h2 id="team-title">{sections.team.title}</h2>
              <p>{sections.team.description}</p>
            </div>
            <Link className={styles.teamButton} to={sections.team.destination || '/team'}>
              {sections.team.buttonLabel}<span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      )}

    </main>
  );
}
