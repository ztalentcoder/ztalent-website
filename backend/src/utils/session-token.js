import { createHash, randomBytes } from 'node:crypto';

export function generateSessionToken() {
  return randomBytes(32).toString('hex');
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
