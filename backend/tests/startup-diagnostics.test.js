import assert from 'node:assert/strict';
import test from 'node:test';
import { formatStartupFailure } from '../src/utils/startup-diagnostics.js';

test('reports the startup stage, configured port, and occupied-port cause', () => {
  const error = Object.assign(new Error('listen EADDRINUSE: address already in use :::3000'), {
    code: 'EADDRINUSE',
  });

  const message = formatStartupFailure(error, {
    stage: 'HTTP server binding',
    port: 3000,
  });

  assert.match(message, /HTTP server binding/);
  assert.match(message, /configured port 3000/);
  assert.match(message, /EADDRINUSE/);
  assert.match(message, /already occupied/);
});

test('redacts database credentials and secret values from startup errors', () => {
  const databaseUrl = 'postgresql://admin:db-password@db.example:5432/ztalent?sslmode=require';
  const error = Object.assign(new Error(
    `Connection failed for ${databaseUrl}; password=db-password; token=api-token; Authorization: Bearer bearer-token`,
  ), { code: 'P1001' });

  const message = formatStartupFailure(error, {
    stage: 'database connection',
    port: 3000,
    databaseUrl,
    sensitiveValues: ['api-token', 'bearer-token'],
  });

  assert.match(message, /database connection/);
  assert.match(message, /P1001/);
  assert.match(message, /configured port 3000/);
  assert.doesNotMatch(message, /admin|db-password|api-token|bearer-token/);
  assert.match(message, /REDACTED/);
});
