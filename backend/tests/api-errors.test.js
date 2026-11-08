import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { createApp, createPrismaStub, withServer } from './helpers.js';
import { errorHandler } from '../src/middleware/error-handler.js';

test('unknown API routes return a consistent 404 JSON error', async () => {
  const app = createApp({ prismaClient: createPrismaStub() });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/missing`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  });
});

test('invalid JSON request bodies return HTTP 400', async () => {
  const app = createApp({ prismaClient: createPrismaStub() });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains invalid JSON.',
      },
    });
  });
});

test('oversized request bodies return HTTP 413', async () => {
  const app = createApp({ prismaClient: createPrismaStub() });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: 'x'.repeat(110 * 1024) }),
    });

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds the allowed size.',
      },
    });
  });
});

test('unexpected production errors return a safe HTTP 500 response', async () => {
  const app = express();
  app.get('/failure', () => {
    throw new Error('test-only private diagnostic');
  });
  app.use(errorHandler);

  const previousNodeEnv = process.env.NODE_ENV;
  const originalError = console.error;
  process.env.NODE_ENV = 'production';
  console.error = () => {};

  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/failure`);
      const body = await response.text();

      assert.equal(response.status, 500);
      assert.deepEqual(JSON.parse(body), {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
      assert.equal(body.includes('test-only private diagnostic'), false);
      assert.equal(body.includes(' at '), false);
    });
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    console.error = originalError;
  }
});
