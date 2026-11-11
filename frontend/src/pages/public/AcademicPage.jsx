import Button from '../../components/common/Button.jsx';
import { PageHero } from '../../components/public/PublicPage.jsx';
import CourseCatalogue from './CourseCatalogue.jsx';
import { PageMetadata } from '../../components/public/PublicContentState.jsx';
import { ContentSection } from '../../components/public/PublicPage.jsx';
import styles from '../../components/public/PublicPage.module.css';

export default function AcademicPage() {
  return (
    <main>
      <PageMetadata title="Academic" description="Published coding, technology and data courses." />
      <PageHero title="Academic" description="Learn to code and work with data. Every course is free on our YouTube channel." />
      <CourseCatalogue />
      <ContentSection soft>
        <div className={styles.subscribe}>
          <div>
            <h2>New episodes every week</h2>
            <p>Subscribe on YouTube so you never miss a lesson.</p>
          </div>
          <Button href="https://youtube.com/" target="_blank" rel="noreferrer">Subscribe on YouTube</Button>
        </div>
      </ContentSection>
    </main>
  );
}
