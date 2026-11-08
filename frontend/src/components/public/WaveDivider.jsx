import styles from './WaveDivider.module.css';

const path = 'M0 40C150 80 450 0 600 40C750 80 1050 0 1200 40C1350 80 1650 0 1800 40C1950 80 2250 0 2400 40V80H0Z';

export default function WaveDivider() {
  return (
    <div className={styles.waves} aria-hidden="true">
      {['waveOne', 'waveTwo', 'waveThree'].map((wave) => (
        <svg className={styles[wave]} key={wave} viewBox="0 0 2400 80" preserveAspectRatio="none">
          <path d={path} />
        </svg>
      ))}
    </div>
  );
}
