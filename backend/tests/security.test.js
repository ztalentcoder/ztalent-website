import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp, createPrismaStub, withServer } from './helpers.js';

const frontendOrigin = 'http://frontend.test';
const app = createApp({
  prismaClient: createPrismaStub(),
  frontendOrigin,
});

test('security headers are present on API responses', async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
  });
});

test('configured frontend origin receives CORS permission', async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: frontendOrigin },
    });

    assert.equal(response.headers.get('access-control-allow-origin'), frontendOrigin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.match(response.headers.get('access-control-allow-methods'), /GET/);
  });
});

test('unapproved origins are not granted CORS permission', async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://unapproved.test' },
    });

    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
  });
});

test('allowed CORS preflight requests are handled', async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: frontendOrigin,
        'Access-Control-Request-Method': 'GET',
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), frontendOrigin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
});

test('unapproved CORS preflight requests receive no CORS permission', async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://unapproved.test',
        'Access-Control-Request-Method': 'GET',
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
  });
});
