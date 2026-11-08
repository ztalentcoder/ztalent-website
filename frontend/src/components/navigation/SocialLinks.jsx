import { usePublicCompany } from '../../context/PublicContentContext.jsx';
import styles from './SocialLinks.module.css';

const topLinks = [
  { platform: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/ztalentcoder/' },
  { platform: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/ztalentcoder' },
  { platform: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/255618429083' },
  { platform: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@ztalentcoder' },
];

const icons = {
  whatsapp: <path d="M20.5 3.5A11.8 11.8 0 0 0 2 17.7L.5 23.5l6-1.6A11.9 11.9 0 0 0 12 23.2h.1A11.7 11.7 0 0 0 20.5 3.5ZM12 21.2a9.7 9.7 0 0 1-4.9-1.3l-.4-.2-3.5.9.9-3.4-.2-.4a9.7 9.7 0 1 1 8.1 4.4Zm5.3-7.3c-.3-.1-1.6-.8-1.9-.9s-.5-.1-.7.2-.7.9-.9 1.1-.3.2-.6.1a7.8 7.8 0 0 1-2.3-1.4 8.8 8.8 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.5-.6.2-.5a.6.6 0 0 0 0-.5c-.1-.2-.6-1.5-.8-2s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1 2.7 11.4 11.4 0 0 0 4.4 3.9 14.8 14.8 0 0 0 1.5.6 3.7 3.7 0 0 0 1.7.1 2.8 2.8 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3Z" />,
  facebook: <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.3c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z" />,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></>,
  youtube: <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.5 12a31 31 0 0 0-.5-4.8ZM9.7 15.7V8.3l6.4 3.7-6.4 3.7Z" />,
};

export default function SocialLinks({ variant = 'top' }) {
  const { company } = usePublicCompany();
  const configuredLinks = company?.socialLinks ?? [];
  const links = variant === 'top'
    ? topLinks.map((social) => {
      const configuredLink = configuredLinks.find(
        ({ platform }) => platform.trim().toLowerCase() === social.platform,
      );
      return { ...social, url: configuredLink?.url || social.url };
    })
    : configuredLinks;

  if (!links.length) return null;

  return (
    <nav className={`${styles.social} ${styles[variant]}`} aria-label="Social media">
      {links.map(({ platform, url, label: configuredLabel }) => {
        const label = variant === 'top' ? configuredLabel : platform.trim();
        const icon = icons[platform.toLowerCase()];
        return (
          <a
            aria-label={label}
            href={url}
            key={platform}
            rel="noopener noreferrer"
            target="_blank"
            className={styles[platform.toLowerCase()]}
          >
            {icon
              ? <svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>
              : <span>{label}</span>}
          </a>
        );
      })}
    </nav>
  );
}
