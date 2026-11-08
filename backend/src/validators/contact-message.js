import { HttpError } from '../utils/http-error.js';

const contactTopics = new Set([
  'GENERAL_QUESTION',
  'REQUEST_SYSTEM',
  'REQUEST_DATA_SERVICE',
  'COURSE_QUESTION',
]);

const allowedFields = new Set(['name', 'email', 'phone', 'topic', 'message']);

function invalid(message) {
  throw new HttpError(400, 'VALIDATION_ERROR', message);
}

function requiredString(value, field, maxLength) {
  if (typeof value !== 'string') {
    invalid(`${field} is required and must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    invalid(`${field} is required.`);
  }
  if (normalized.length > maxLength) {
    invalid(`${field} must be no more than ${maxLength} characters.`);
  }

  return normalized;
}

export function validateContactMessage(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    invalid('Request body must be a JSON object.');
  }

  const unexpectedFields = Object.keys(payload).filter((field) => !allowedFields.has(field));
  if (unexpectedFields.length > 0) {
    invalid('Request contains unexpected properties.');
  }

  const name = requiredString(payload.name, 'name', 160);
  const email = requiredString(payload.email, 'email', 320).toLowerCase();
  const [localPart, domain, ...extraParts] = email.split('@');
  const domainLabels = domain?.split('.') ?? [];
  const validDomainLabel = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  if (
    !localPart ||
    !domain ||
    extraParts.length > 0 ||
    !/^[^\s@]+$/.test(localPart) ||
    domainLabels.length < 2 ||
    domainLabels.some((label) => label.length > 63 || !validDomainLabel.test(label))
  ) {
    invalid('email must be a valid email address.');
  }

  const topic = requiredString(payload.topic, 'topic', 40);
  if (!contactTopics.has(topic)) {
    invalid('topic must be a supported contact topic.');
  }

  const message = requiredString(payload.message, 'message', 5000);

  let phone = null;
  if (payload.phone !== undefined) {
    if (typeof payload.phone !== 'string') {
      invalid('phone must be a string.');
    }

    phone = payload.phone.trim() || null;
    if (phone && phone.length > 32) {
      invalid('phone must be no more than 32 characters.');
    }
  }

  return { name, email, phone, topic, message };
}
