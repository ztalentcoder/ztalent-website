import { useEffect, useState } from 'react';
import { getPublicImageUrl } from '../../services/publicContentApi.js';

export default function PublicImage({ src, alt, className, style, loading = 'lazy', fallback = null }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = getPublicImageUrl(src);

  useEffect(() => setFailed(false), [src]);

  if (!imageUrl || failed) return fallback;
  return (
    <img
      className={className}
      style={style}
      src={imageUrl}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
