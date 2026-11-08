import { Link } from 'react-router-dom';
import styles from './Button.module.css';

export default function Button({
  children,
  to,
  href,
  variant = 'primary',
  className = '',
  ...props
}) {
  const classNames = `${styles.button} ${styles[variant]} ${className}`.trim();

  if (to) {
    return (
      <Link className={classNames} to={to} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a className={classNames} href={href} {...props}>
      {children}
    </a>
  );
}
