import SocialLinks from './SocialLinks.jsx';
import { usePublicCompany } from '../../context/PublicContentContext.jsx';
import { getCompanyContact } from '../../constants/companyProfile.js';
import styles from './TopBar.module.css';

export default function TopBar() {
  const { company } = usePublicCompany();
  const { email, phone } = getCompanyContact(company);
  const phoneHref = phone.replace(/[^\d+]/g, '');

  return (
    <div className={styles.top}>
      <div className={styles.container}>
        <div className={styles.contact}>
          <a href={`mailto:${email}`}>{email}</a>
          <span className={styles.separator} aria-hidden="true">|</span>
          <a href={`tel:${phoneHref}`}>{phone}</a>
        </div>
        <SocialLinks />
      </div>
    </div>
  );
}
