import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp, createPrismaStub, withServer } from './helpers.js';

test('GET /api/health returns the existing liveness response', async () => {
  const app = createApp({ prismaClient: createPrismaStub() });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('GET /api/health/ready returns ready when the database query succeeds', async () => {
  let queryCount = 0;
  const prismaClient = createPrismaStub(async () => {
    queryCount += 1;
    return 1;
  });
  const app = createApp({ prismaClient });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health/ready`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ready' });
    assert.equal(queryCount, 1);
  });
});

test('GET /api/health/ready returns a safe unavailable response on database failure', async () => {
  const prismaClient = createPrismaStub(async () => {
    throw new Error('test-only database secret');
  });
  const app = createApp({ prismaClient });
  const originalError = console.error;
  console.error = () => {};

  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health/ready`);

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { status: 'unavailable' });
    });
  } finally {
    console.error = originalError;
  }
});
