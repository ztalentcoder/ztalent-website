import Button from '../common/Button.jsx';
import WaveDivider from './WaveDivider.jsx';
import styles from './PublicPage.module.css';

export function PageHero({ title, description, eyebrow, style }) {
  return (
    <section className={styles.hero} style={style}>
      <div className={styles.container}>
        {eyebrow && <p className={styles.heroEyebrow}>{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <WaveDivider />
    </section>
  );
}

export function ContentSection({ children, soft = false, className = '', id }) {
  return (
    <section
      className={`${styles.section}${soft ? ` ${styles.softSection}` : ''}${className ? ` ${className}` : ''}`}
      id={id}
    >
      <div className={styles.container}>{children}</div>
    </section>
  );
}

export function CardGrid({ children, className = '' }) {
  return <div className={`${styles.grid}${className ? ` ${className}` : ''}`}>{children}</div>;
}

export function InfoCard({ title, description, eyebrow, children, footer, className = '' }) {
  return (
    <article className={`${styles.card}${className ? ` ${className}` : ''}`}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {children}
      {footer && <div className={styles.cardFooter}>{footer}</div>}
    </article>
  );
}

export function CallToAction({ title = 'Have a digital or data problem?', description = 'Tell us what you need and we will help you solve it.', buttonLabel = 'Get a Quote', to = '/contact' }) {
  return (
    <ContentSection>
      <div className={styles.cta}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Button to={to} variant="light">{buttonLabel}</Button>
      </div>
    </ContentSection>
  );
}

export { default as styles } from './PublicPage.module.css';
