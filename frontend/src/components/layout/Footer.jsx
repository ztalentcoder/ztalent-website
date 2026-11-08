import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../assets/ztalent-logo.png';
import SocialLinks from '../navigation/SocialLinks.jsx';
import { usePublicCompany } from '../../context/PublicContentContext.jsx';
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
  const email = company?.email || 'ztalentcoder@gmail.com';
  const phone = company?.phone || '+255 618 429 083';
  const phoneHref = phone.replace(/[^\d+]/g, '');

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
            <a href={`mailto:${email}`}>{email}</a>
            <a href={`tel:${phoneHref}`}>{phone}</a>
            {company?.location && <Link to="/contact">{company.location}</Link>}
          </div>
        </div>
        <div className={styles.copyright}>
          © {new Date().getFullYear()} Ztalent Coder. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
