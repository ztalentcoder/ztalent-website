import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const envFilePath = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envFilePath });

export class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = 'BACKEND_CONFIG_INVALID';
  }
}

function getPort(value) {
  if (value === undefined) return 3000;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError('Invalid backend configuration: PORT must be an integer from 1 to 65535.');
  }

  return port;
}

function validateDatabaseUrl(value) {
  if (!value) {
    throw new ConfigurationError('Invalid backend configuration: DATABASE_URL is required.');
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(value);
  } catch {
    throw new ConfigurationError('Invalid backend configuration: DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    !databaseUrl.hostname ||
    databaseUrl.pathname.length < 2
  ) {
    throw new ConfigurationError('Invalid backend configuration: DATABASE_URL must identify a PostgreSQL host and database.');
  }

  return value;
}

function validateFrontendOrigin(value) {
  if (!value) {
    throw new ConfigurationError('Invalid backend configuration: FRONTEND_ORIGIN is required.');
  }

  let frontendOrigin;
  try {
    frontendOrigin = new URL(value);
  } catch {
    throw new ConfigurationError('Invalid backend configuration: FRONTEND_ORIGIN must be a valid HTTP(S) origin.');
  }

  if (
    !['http:', 'https:'].includes(frontendOrigin.protocol) ||
    !frontendOrigin.hostname ||
    frontendOrigin.username ||
    frontendOrigin.password ||
    frontendOrigin.pathname !== '/' ||
    frontendOrigin.search ||
    frontendOrigin.hash
  ) {
    throw new ConfigurationError('Invalid backend configuration: FRONTEND_ORIGIN must be a valid HTTP(S) origin.');
  }

  return frontendOrigin.origin;
}

export const config = Object.freeze({
  port: getPort(process.env.PORT),
  databaseUrl: validateDatabaseUrl(process.env.DATABASE_URL),
  frontendOrigin: validateFrontendOrigin(process.env.FRONTEND_ORIGIN),
});
