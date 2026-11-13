import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import logo from '../../assets/ztalent-logo.png';
import SocialLinks from '../navigation/SocialLinks.jsx';
import { usePublicCompany } from '../../context/PublicContentContext.jsx';
import { DEFAULT_COMPANY_CONTACT } from '../../constants/companyProfile.js';
import { getPublicImageUrl } from '../../services/publicContentApi.js';
import styles from './Footer.module.css';

const pillars = [
  { label: 'Academic', to: '/academic' },
  { label: 'Tech Solutions', to: '/tech-solutions' },
  { label: 'Data & AI', to: '/data-ai' },
];

const companyLinks = [
  { label: 'About us', to: '/about' },
  { label: 'Our team', to: '/team' },
  { label: 'Portfolio', to: '/portfolio' },
  { label: 'Blog', to: '/blog' },
];

export default function Footer() {
  const { company } = usePublicCompany();
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = getPublicImageUrl(company?.logoUrl);
  const { email, phone, location } = DEFAULT_COMPANY_CONTACT;
  const phoneHref = phone?.replace(/[^\d+]/g, '');

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.brandColumn}>
            <Link className={styles.brand} to="/">
              <img
                src={logoUrl && !logoFailed ? logoUrl : logo}
                alt={`${company?.name || 'Ztalent Coder'}, Tech Company Solutions`}
                onError={() => setLogoFailed(true)}
              />
            </Link>
            <p>{company?.tagline || 'We teach talent, build solutions and turn data into decisions.'}</p>
            <SocialLinks variant="footer" />
          </div>

          <div className={styles.linkColumn}>
            <h2>Pillars</h2>
            {pillars.map(({ label, to }) => <Link key={to} to={to}>{label}</Link>)}
          </div>

          <div className={styles.linkColumn}>
            <h2>Company</h2>
            {companyLinks.map(({ label, to }) => <Link key={to} to={to}>{label}</Link>)}
          </div>

          <div className={styles.linkColumn}>
            <h2>Contact</h2>
            <div className={styles.contactItem}>
              <Mail aria-hidden="true" />
              <a href={`mailto:${email}`}>{email}</a>
            </div>
            <div className={styles.contactItem}>
              <Phone aria-hidden="true" />
              <a href={`tel:${phoneHref}`}>{phone}</a>
            </div>
            <div className={styles.contactItem}>
              <MapPin aria-hidden="true" />
              <Link to="/contact">{location}</Link>
            </div>
          </div>
        </div>
        <div className={styles.copyright}>
          © {new Date().getFullYear()} Ztalent Coder. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
