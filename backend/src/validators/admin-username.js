import { HttpError } from '../utils/http-error.js';

export const ADMIN_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;

export function normalizeAdminUsername(value) {
  if (typeof value !== 'string') return null;
  const username = value.trim().toLowerCase();
  return ADMIN_USERNAME_PATTERN.test(username) ? username : null;
}

export function usernameFromEmail(email) {
  const localPart = email.split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 64);
  return normalizeAdminUsername(localPart) ?? 'admin';
}

export function requireAdminUsername(value) {
  const username = normalizeAdminUsername(value);
  if (!username) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Username must be 3 to 64 characters and use letters, numbers, dots, underscores, or hyphens.',
    );
  }
  return username;
}
