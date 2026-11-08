import { HttpError } from '../utils/http-error.js';

const allowedFields = new Set(['email', 'password']);

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

  if (typeof payload.email !== 'string' || typeof payload.password !== 'string') {
    invalid('Email and password are required and must be strings.');
  }

  const email = payload.email.trim().toLowerCase();
  const password = payload.password;
  const [localPart, domain, ...extraParts] = email.split('@');
  const domainLabels = domain?.split('.') ?? [];
  const validDomainLabel = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

  if (
    !email ||
    email.length > 320 ||
    !localPart ||
    !domain ||
    extraParts.length > 0 ||
    !/^[^\s@]+$/.test(localPart) ||
    domainLabels.length < 2 ||
    domainLabels.some((label) => label.length > 63 || !validDomainLabel.test(label))
  ) {
    invalid('Email must be a valid email address.');
  }

  if (!password) {
    invalid('Password is required.');
  }

  return { email, password };
}
