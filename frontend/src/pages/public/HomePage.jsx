import { useEffect, useRef, useState } from 'react';
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

const statisticDefinitions = [
  { key: 'projects-delivered', label: 'Projects Delivered', description: 'Digital solutions built to address real-world challenges.' },
  { key: 'academic-courses', label: 'Academic Courses', description: 'Learning opportunities available to develop technology skills.' },
  { key: 'institutions-served', label: 'Institutions Served', description: 'Organizations supported through our technology solutions.' },
  { key: 'students-reached', label: 'Students Reached', description: 'Learners reached through our academic and training initiatives.' },
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
    imagePosition: '50% center',
    mobileImagePosition: '56% center',
    heading: 'We Teach Talent, Build Solutions and Turn Data Into Decisions',
    description: (company) => company?.description || 'Ztalent Coder helps students learn to code, gives institutions the systems they need, and helps organizations make sense of their data.',
  },
  {
    label: 'Web & Mobile Development',
    image: '/images/image2.jpg',
    imagePosition: '56% center',
    mobileImagePosition: '62% center',
    heading: 'Building Digital Experiences That Matter',
    description: () => 'We design and develop modern websites, web applications, and mobile solutions that help businesses and individuals grow, connect, and succeed in the digital world.',
  },
  {
    label: 'AI & Data Solutions',
    image: '/images/image3.avif',
    imagePosition: '50% center',
    mobileImagePosition: '58% center',
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

function useStatisticsVisibility(ref) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return undefined;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.2 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return visible;
}

function AnimatedStatistic({ value, active }) {
  const [displayValue, setDisplayValue] = useState(0);
  const displayValueRef = useRef(0);

  useEffect(() => {
    if (value === 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      displayValueRef.current = value;
      setDisplayValue(value);
      return undefined;
    }
    if (!active) return undefined;

    let frame;
    let startTime;
    const startValue = displayValueRef.current;
    const duration = 1200;
    const animate = (time) => {
      if (startTime === undefined) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - ((1 - progress) ** 3);
      const nextValue = Math.round(startValue + (value - startValue) * eased);
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [active, value]);

  return displayValue;
}

export default function HomePage() {
  const { company } = usePublicCompany();
  const statistics = usePublicContent('statistics', {}, { refreshIntervalMs: 60_000 });
  const areas = usePublicContent('business-areas', { pageSize: 6 });
  const testimonials = usePublicContent('testimonials', { pageSize: 3 });
  const publishedAreas = areas.data?.items ?? [];
  const publishedTestimonials = testimonials.data?.items ?? [];
  const statsSection = useRef(null);
  const statisticsVisible = useStatisticsVisibility(statsSection);
  const metrics = statistics.status === 'success'
    ? (statistics.data?.statistics ?? [])
    : statisticDefinitions.map((metric) => ({ ...metric, value: 0 }));
  const [introImageFailed, setIntroImageFailed] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroSlideInteraction, setHeroSlideInteraction] = useState(0);

  function handleHeroPointerMove(event) {
    const supportsFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!supportsFinePointer || reducedMotion || event.pointerType !== 'mouse') return;

    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const horizontal = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
    const vertical = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
    event.currentTarget.style.setProperty('--hero-tilt-x', `${-vertical * 3}deg`);
    event.currentTarget.style.setProperty('--hero-tilt-y', `${horizontal * 3}deg`);
  }

  function resetHeroTilt(event) {
    event.currentTarget.style.setProperty('--hero-tilt-x', '0deg');
    event.currentTarget.style.setProperty('--hero-tilt-y', '0deg');
  }

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timeout = window.setTimeout(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, [activeHeroSlide, heroSlideInteraction]);

  useEffect(() => setIntroImageFailed(false), [company?.homeIntroImageUrl]);

  return (
    <main>
      <PageMetadata title={company?.name || 'Home'} description={company?.description || company?.tagline} />
      <section
        className={styles.hero}
        id="home"
        onPointerMove={handleHeroPointerMove}
        onPointerLeave={resetHeroTilt}
      >
        {heroSlides.map((slide, index) => (
          <div
            className={`${styles.heroImage} ${index === activeHeroSlide ? styles.heroImageActive : ''}`}
            key={slide.image}
            style={{
              backgroundImage: `url("${slide.image}")`,
              '--hero-image-position': slide.imagePosition,
              '--hero-image-position-mobile': slide.mobileImagePosition,
            }}
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
          <div className={styles.aboutImage}>
            <img
              src={!introImageFailed
                ? getPublicImageUrl(company?.homeIntroImageUrl) || '/images/image1.jpg'
                : '/images/image1.jpg'}
              alt="A coding workspace representing Ztalent Coder's training and technology solutions"
              onError={() => setIntroImageFailed(true)}
            />
          </div>
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

      <section ref={statsSection} className={styles.stats} aria-label="Ztalent Coder at a glance" aria-busy={statistics.status === 'loading'}>
        <div className={styles.container}>
          <SectionHeading
            className={styles.statsHeading}
            id="home-statistics-heading"
            title="Our Impact in Numbers"
            description="A snapshot of our achievements, the solutions we deliver, and the communities we reach."
          />
          <div className={styles.statsGrid}>
            {metrics.map((metric) => {
              const value = Number.isInteger(metric?.value) && metric.value >= 0 ? metric.value : 0;
              return (
                <article className={styles.statCard} key={metric.key}>
                  <strong><AnimatedStatistic value={value} active={statisticsVisible} /></strong>
                  <h3 className={styles.statLabel}>{metric.label}</h3>
                </article>
              );
            })}
            {statistics.status === 'error' && (
              <div className={styles.statisticsError} role="alert">
                <span>Statistics are temporarily unavailable.</span>
                <button type="button" onClick={statistics.retry}>Try again</button>
              </div>
            )}
          </div>
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
