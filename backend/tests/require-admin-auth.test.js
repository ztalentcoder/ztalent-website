import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { withServer } from './helpers.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requireAdminAuth } from '../src/middleware/require-admin-auth.js';
import { hashSessionToken } from '../src/utils/session-token.js';

const sessionToken = 'c'.repeat(64);
const sessionTokenHash = hashSessionToken(sessionToken);
const admin = {
  id: 'admin-id',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'SUPER_ADMIN',
  isActive: true,
};

function createMiddlewareTestApp({
  session = {
    id: 'session-id',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    adminUser: admin,
  },
  findUniqueError,
  updateError,
} = {}) {
  const calls = {
    lookup: [],
    update: [],
    protectedHandler: 0,
  };
  const app = express();
  app.locals.prisma = {
    adminSession: {
      findUnique: async (args) => {
        calls.lookup.push(args);
        if (findUniqueError) throw findUniqueError;
        return session;
      },
      update: async (args) => {
        calls.update.push(args);
        if (updateError) throw updateError;
        return {};
      },
    },
  };
  app.get('/protected', requireAdminAuth, (request, response) => {
    calls.protectedHandler += 1;
    response.json({ admin: request.admin });
  });
  app.use(errorHandler);

  return { app, calls };
}

async function getProtected(baseUrl, cookie) {
  return fetch(`${baseUrl}/protected`, {
    headers: cookie === undefined ? {} : { Cookie: cookie },
  });
}

function captureErrorLogs(t) {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  return logs;
}

test('valid session attaches only safe admin fields, updates last-seen, and calls next', async () => {
  const { app, calls } = createMiddlewareTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await getProtected(baseUrl, `admin_session=${sessionToken}`);
    const responseText = await response.text();

    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(responseText), {
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
    assert.equal(responseText.includes(sessionToken), false);
    assert.equal(responseText.includes(sessionTokenHash), false);
    assert.equal(responseText.includes('passwordHash'), false);
    assert.deepEqual(calls.lookup, [{
      where: { tokenHash: sessionTokenHash },
      select: {
        id: true,
        revokedAt: true,
        expiresAt: true,
        adminUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    }]);
    assert.equal(calls.update.length, 1);
    assert.deepEqual(calls.update[0].where, { id: 'session-id' });
    assert.ok(calls.update[0].data.lastSeenAt instanceof Date);
    assert.ok(Math.abs(Date.now() - calls.update[0].data.lastSeenAt.getTime()) < 5_000);
    assert.equal(calls.protectedHandler, 1);
  });
});

test('missing, empty, and malformed tokens are rejected without database access', async (t) => {
  const logs = captureErrorLogs(t);
  const cookies = [undefined, 'admin_session=', `admin_session=${'C'.repeat(64)}`, 'admin_session=bad'];

  for (const cookie of cookies) {
    const { app, calls } = createMiddlewareTestApp();
    await withServer(app, async (baseUrl) => {
      const response = await getProtected(baseUrl, cookie);

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        error: {
          code: 'INVALID_SESSION',
          message: 'Authentication required.',
        },
      });
    });
    assert.equal(calls.lookup.length, 0);
    assert.equal(calls.update.length, 0);
    assert.equal(calls.protectedHandler, 0);
  }

  assert.equal(JSON.stringify(logs).includes(sessionToken), false);
  assert.equal(JSON.stringify(logs).includes(sessionTokenHash), false);
});

test('unknown, revoked, expired, and inactive-admin sessions are rejected without updates', async (t) => {
  const logs = captureErrorLogs(t);
  const invalidSessions = [
    null,
    { revokedAt: new Date() },
    { expiresAt: new Date(Date.now() - 1) },
    { adminUser: { ...admin, isActive: false } },
    { adminUser: null },
  ];

  for (const invalidSession of invalidSessions) {
    const { app, calls } = createMiddlewareTestApp({
      session: invalidSession === null
        ? null
        : {
          id: 'session-id',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          adminUser: admin,
          ...invalidSession,
        },
    });

    await withServer(app, async (baseUrl) => {
      const response = await getProtected(baseUrl, `admin_session=${sessionToken}`);

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        error: {
          code: 'INVALID_SESSION',
          message: 'Authentication required.',
        },
      });
    });
    assert.equal(calls.update.length, 0);
    assert.equal(calls.protectedHandler, 0);
  }

  assert.equal(JSON.stringify(logs).includes(sessionToken), false);
  assert.equal(JSON.stringify(logs).includes(sessionTokenHash), false);
});

test('lookup failures reach centralized error handling and prevent access', async (t) => {
  const diagnostic = 'private lookup diagnostic';
  const logs = captureErrorLogs(t);
  const { app, calls } = createMiddlewareTestApp({
    findUniqueError: new Error(diagnostic),
  });

  await withServer(app, async (baseUrl) => {
    const response = await getProtected(baseUrl, `admin_session=${sessionToken}`);
    const responseText = await response.text();

    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(responseText), {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
    assert.equal(responseText.includes(diagnostic), false);
    assert.equal(responseText.includes(sessionToken), false);
    assert.equal(JSON.stringify(logs).includes(diagnostic), false);
    assert.equal(JSON.stringify(logs).includes(sessionToken), false);
    assert.equal(JSON.stringify(logs).includes(sessionTokenHash), false);
    assert.equal(calls.protectedHandler, 0);
  });
});

test('last-seen update failure reaches centralized error handling and prevents access', async (t) => {
  const diagnostic = 'private update diagnostic';
  const logs = captureErrorLogs(t);
  const { app, calls } = createMiddlewareTestApp({
    updateError: new Error(diagnostic),
  });

  await withServer(app, async (baseUrl) => {
    const response = await getProtected(baseUrl, `admin_session=${sessionToken}`);
    const responseText = await response.text();

    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(responseText), {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
    assert.equal(responseText.includes(diagnostic), false);
    assert.equal(responseText.includes(sessionToken), false);
    assert.equal(JSON.stringify(logs).includes(diagnostic), false);
    assert.equal(JSON.stringify(logs).includes(sessionToken), false);
    assert.equal(JSON.stringify(logs).includes(sessionTokenHash), false);
    assert.equal(calls.update.length, 1);
    assert.equal(calls.protectedHandler, 0);
  });
});
