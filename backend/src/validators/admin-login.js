import { HttpError } from '../utils/http-error.js';
import { normalizeAdminUsername } from './admin-username.js';

const allowedFields = new Set(['email', 'identifier', 'password']);

function invalid(message) {
  throw new HttpError(400, 'VALIDATION_ERROR', message);
}

export function validateAdminLogin(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    invalid('Request body must be a JSON object.');
  }

  if (Object.keys(payload).some((field) => !allowedFields.has(field))) {
    invalid('Request contains unexpected properties.');
  }

  if (
    (Object.hasOwn(payload, 'email') && Object.hasOwn(payload, 'identifier'))
    || typeof (payload.identifier ?? payload.email) !== 'string'
    || typeof payload.password !== 'string'
  ) {
    invalid('Email or username and password are required and must be strings.');
  }

  const identifierField = Object.hasOwn(payload, 'identifier') ? 'identifier' : 'email';
  const identifier = payload[identifierField].trim().toLowerCase();
  const password = payload.password;
  if (identifierField === 'email' || identifier.includes('@')) {
    const [localPart, domain, ...extraParts] = identifier.split('@');
    const domainLabels = domain?.split('.') ?? [];
    const validDomainLabel = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

    if (
      !identifier ||
      identifier.length > 320 ||
      !localPart ||
      !domain ||
      extraParts.length > 0 ||
      !/^[^\s@]+$/.test(localPart) ||
      domainLabels.length < 2 ||
      domainLabels.some((label) => label.length > 63 || !validDomainLabel.test(label))
    ) {
      invalid('Enter a valid email address or username.');
    }
    if (!password) invalid('Password is required.');
    return { identifier, identifierType: 'email', password };
  }

  if (!normalizeAdminUsername(identifier)) invalid('Enter a valid email address or username.');
  if (!password) {
    invalid('Password is required.');
  }

  return { identifier, identifierType: 'username', password };
}
