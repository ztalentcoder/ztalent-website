import SocialLinks from './SocialLinks.jsx';
import styles from './TopBar.module.css';

export default function TopBar() {
  return (
    <div className={styles.top}>
      <div className={styles.container}>
        <div className={styles.contact}>
          <a href="mailto:ztalentcoder@gmail.com">ztalentcoder@gmail.com</a>
          <span className={styles.separator} aria-hidden="true">|</span>
          <a href="tel:+255618429083">+255 618 429 083</a>
        </div>
        <SocialLinks />
      </div>
    </div>
  );
}
