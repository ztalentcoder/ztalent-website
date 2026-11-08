const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin;

export function getPublicImageUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value, window.location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (value.startsWith('/uploads/images/')) {
      return new URL(value, apiOrigin).href;
    }
    return url.href;
  } catch {
    return null;
  }
}

export class PublicContentApiError extends Error {
  constructor(status) {
    super(status >= 500
      ? 'Public content is temporarily unavailable.'
      : 'The requested content could not be loaded.');
    this.name = 'PublicContentApiError';
    this.status = status;
  }
}

export async function getPublicContent(path, query = {}) {
  const url = new URL(`${apiBaseUrl}/public/${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url.toString());
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) throw new PublicContentApiError(response.status);
  return payload;
}

export function getPublicList(path, query) {
  return getPublicContent(path, query);
}
