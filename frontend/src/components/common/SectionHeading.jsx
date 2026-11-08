import styles from './SectionHeading.module.css';

export default function SectionHeading({ eyebrow, title, description, align = 'center', id, className = '' }) {
  return (
    <div className={`${styles.heading} ${styles[align]}${className ? ` ${className}` : ''}`}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h2 id={id}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
