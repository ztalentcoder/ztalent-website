import { useEffect, useState } from 'react';
import AboutIllustration from '../../components/common/AboutIllustration.jsx';
import Button from '../../components/common/Button.jsx';
import PrototypeIcon from '../../components/common/PrototypeIcon.jsx';
import SectionHeading from '../../components/common/SectionHeading.jsx';
import WaveDivider from '../../components/public/WaveDivider.jsx';
import { PageMetadata, PublicContentState } from '../../components/public/PublicContentState.jsx';
import { usePublicCompany } from '../../context/PublicContentContext.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';
import { getPublicImageUrl } from '../../services/publicContentApi.js';
import styles from './HomePage.module.css';

const pillars = [
  {
    title: 'Academic',
    description: 'Free coding and tech courses on our YouTube channel, taught step by step.',
    link: 'Explore courses',
    to: '/academic',
  },
  {
    title: 'Tech Solutions',
    description: 'Our own solutions for community problems, and custom systems built for your institution.',
    link: 'See solutions',
    to: '/tech-solutions',
  },
  {
    title: 'Data & AI',
    description: 'Data pipelines, analysis, consulting and AI solutions that fit your real problems.',
    link: 'See data services',
    to: '/data-ai',
  },
];

const highlights = [
  'Free courses for beginners',
  'Custom systems for institutions',
  'Data and AI advice that is practical',
];

const workSteps = [
  { number: '1', title: 'Consult', description: 'We listen and define the problem together.' },
  { number: '2', title: 'Design', description: 'We plan the system and agree on scope.' },
  { number: '3', title: 'Build', description: 'We develop and test with your team.' },
  { number: '4', title: 'Launch and support', description: 'We go live and stay with you after.' },
];

const heroSlides = [
  {
    label: 'Academic / Teach Talent',
    image: '/images/image1.jpg',
    heading: 'We Teach Talent, Build Solutions and Turn Data Into Decisions',
    description: (company) => company?.description || 'Ztalent Coder helps students learn to code, gives institutions the systems they need, and helps organizations make sense of their data.',
  },
  {
    label: 'Web & Mobile Development',
    image: '/images/image2.jpg',
    heading: 'Building Digital Experiences That Matter',
    description: () => 'We design and develop modern websites, web applications, and mobile solutions that help businesses and individuals grow, connect, and succeed in the digital world.',
  },
  {
    label: 'AI & Data Solutions',
    image: '/images/image3.avif',
    heading: 'Turning Data into Intelligent Solutions',
    description: () => 'We harness the power of data and artificial intelligence to uncover insights, automate processes, and build smarter solutions for real-world challenges.',
  },
];

function getAreaIcon(name) {
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes('academic')) return 'academic';
  if (normalizedName.includes('data')) return 'data';
  return 'solutions';
}

function BusinessAreaCard({ area, link, to }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getPublicImageUrl(area.imageUrl);

  return (
    <article className={styles.card}>
      <div className={styles.cardImage}>
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={`${area.name} business area`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={styles.imageFallback} aria-hidden="true">
            <PrototypeIcon name={getAreaIcon(area.name)} />
          </div>
        )}
      </div>
      <div className={styles.cardBody}>
        <h3>{area.name}</h3>
        <p>{area.summary || area.description}</p>
        <Button className={styles.cardLink} to={to} variant="text">
          {link}
        </Button>
      </div>
    </article>
  );
}

export default function HomePage() {
  const { company } = usePublicCompany();
  const statistics = usePublicContent('site-statistics', { pageSize: 8 });
  const areas = usePublicContent('business-areas', { pageSize: 6 });
  const testimonials = usePublicContent('testimonials', { pageSize: 3 });
  const publishedAreas = areas.data?.items ?? [];
  const publishedStatistics = statistics.data?.items ?? [];
  const publishedTestimonials = testimonials.data?.items ?? [];
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroSlideInteraction, setHeroSlideInteraction] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timeout = window.setTimeout(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, [activeHeroSlide, heroSlideInteraction]);

  return (
    <main>
      <PageMetadata title={company?.name || 'Home'} description={company?.description || company?.tagline} />
      <section className={styles.hero} id="home">
        {heroSlides.map((slide, index) => (
          <div
            className={`${styles.heroImage} ${index === activeHeroSlide ? styles.heroImageActive : ''}`}
            key={slide.image}
            style={{ backgroundImage: `url("${slide.image}")` }}
            aria-hidden="true"
          />
        ))}
        <div className={styles.heroContent}>
          <div className={styles.heroCopy} key={activeHeroSlide}>
            <h1>{heroSlides[activeHeroSlide].heading}</h1>
            <p>{heroSlides[activeHeroSlide].description(company)}</p>
            <div className={styles.heroActions}>
              <Button to="/contact">Get a Quote</Button>
              <Button to="/academic" variant="secondary">Watch Courses</Button>
            </div>
          </div>
        </div>
        <div className={styles.heroIndicators} role="group" aria-label="Hero slides">
          {heroSlides.map((slide, index) => (
            <button
              aria-label={`Show slide ${index + 1}: ${slide.label}`}
              aria-pressed={index === activeHeroSlide}
              className={index === activeHeroSlide ? styles.heroIndicatorActive : ''}
              key={slide.image}
              onClick={() => {
                setActiveHeroSlide(index);
                setHeroSlideInteraction((interaction) => interaction + 1);
              }}
              type="button"
            />
          ))}
        </div>
        <WaveDivider />
      </section>

      <section className={styles.section} aria-labelledby="what-we-do">
        <div className={styles.container}>
          <SectionHeading
            id="what-we-do"
            title="What we do"
            description="Three pillars that feed each other: courses grow the talent, talent builds solutions, solutions run on good data."
          />
          {publishedAreas.length > 0 ? (
            <div className={styles.cardGrid}>
              {publishedAreas.map((area) => (
                <BusinessAreaCard
                  area={area}
                  key={area.slug}
                  link="Explore area"
                  to="/tech-solutions#business-areas"
                />
              ))}
            </div>
          ) : areas.status === 'success' ? (
            <div className={styles.cardGrid}>
              {pillars.map((pillar) => (
                <BusinessAreaCard
                  area={{
                    name: pillar.title,
                    summary: pillar.description,
                  }}
                  key={pillar.title}
                  link={pillar.link}
                  to={pillar.to}
                />
              ))}
            </div>
          ) : (
            <PublicContentState status={areas.status} error={areas.error} retry={areas.retry} />
          )}
        </div>
      </section>

      <section className={`${styles.section} ${styles.softSection}`}>
        <div className={`${styles.container} ${styles.split}`}>
          <AboutIllustration />
          <div className={styles.aboutCopy}>
            <h2>A tech team you can learn from and build with</h2>
            <p>
              Ztalent Coder is a young company that trains local talent and uses that talent to build real systems and data solutions.
            </p>
            <ul>
              {highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
            </ul>
            <Button to="/about">About us</Button>
          </div>
        </div>
      </section>

      <section className={styles.stats} aria-label="Ztalent Coder at a glance">
        <div className={`${styles.container} ${styles.statsGrid}`}>
          {publishedStatistics.map((metric) => (
            <article className={styles.statCard} key={metric.key}>
              <span className={styles.statIcon}><PrototypeIcon name="projects" /></span>
              <strong>{metric.value}{metric.suffix || ''}</strong>
              <span className={styles.statLabel}>{metric.label}</span>
            </article>
          ))}
          {publishedStatistics.length === 0 && (
            <PublicContentState
              status={statistics.status}
              error={statistics.error}
              retry={statistics.retry}
              empty="Company statistics will appear here when published."
            />
          )}
        </div>
      </section>

      {(publishedTestimonials.length > 0 || testimonials.status === 'error') && (
        <section className={styles.section}>
          <div className={styles.container}>
            <SectionHeading title="What clients say" />
            {publishedTestimonials.length > 0 ? (
              <div className={styles.cardGrid}>
                {publishedTestimonials.map((testimonial, index) => (
                  <article className={styles.card} key={`${testimonial.attributionName || 'client'}-${index}`}>
                    <blockquote>“{testimonial.quote}”</blockquote>
                    <p>{[testimonial.attributionName, testimonial.attributionOrganization].filter(Boolean).join(', ')}</p>
                  </article>
                ))}
              </div>
            ) : <PublicContentState status={testimonials.status} error={testimonials.error} retry={testimonials.retry} />}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.container}>
          <SectionHeading
            title="How we work"
            description="From idea to launch in four simple steps."
          />
          <div className={styles.stepsGrid}>
            {workSteps.map((step) => (
              <article className={styles.step} key={step.number}>
                <span className={styles.stepNumber}>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.container} ${styles.cta}`}>
          <div>
            <h2>Have a digital or data problem?</h2>
            <p>Tell us what you need and we will help you solve it.</p>
          </div>
          <Button to="/contact" variant="light">Get a Quote</Button>
        </div>
      </section>
    </main>
  );
}
