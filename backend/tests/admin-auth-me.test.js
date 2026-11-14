import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp, createPrismaStub, withServer } from './helpers.js';
import { hashSessionToken } from '../src/utils/session-token.js';

const sessionToken = 'a'.repeat(64);
const sessionTokenHash = hashSessionToken(sessionToken);
const admin = {
  id: 'admin-id',
  username: 'admin',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'SUPER_ADMIN',
  isActive: true,
};

function createMeTestApp({
  session = {
    id: 'session-id',
    tokenHash: sessionTokenHash,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    lastSeenAt: null,
    adminUser: admin,
  },
  findUniqueError,
  updateError,
} = {}) {
  const calls = {
    lookup: [],
    update: [],
  };
  const prismaClient = {
    ...createPrismaStub(),
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

  return {
    app: createApp({ prismaClient }),
    calls,
  };
}

async function getCurrentAdmin(baseUrl, cookie) {
  return fetch(`${baseUrl}/api/admin/auth/me`, {
    headers: cookie === undefined ? {} : { Cookie: cookie },
  });
}

function captureErrorLogs(t) {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  return logs;
}

test('valid session returns only safe admin fields and updates last-seen time', async () => {
  const { app, calls } = createMeTestApp();

  await withServer(app, async (baseUrl) => {
    const response = await getCurrentAdmin(baseUrl, `admin_session=${sessionToken}`);
    const responseText = await response.text();

    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(responseText), {
      status: 'success',
      admin: {
        id: admin.id,
        username: admin.username,
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
            username: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    }]);
    assert.equal(calls.update.length, 1);
    assert.equal(calls.update[0].where.id, 'session-id');
    assert.ok(calls.update[0].data.lastSeenAt instanceof Date);
    assert.ok(Math.abs(Date.now() - calls.update[0].data.lastSeenAt.getTime()) < 5_000);
  });
});

test('missing, empty, and malformed cookies return the same generic unauthorized response', async (t) => {
  const logs = captureErrorLogs(t);
  const { app, calls } = createMeTestApp();

  await withServer(app, async (baseUrl) => {
    const responses = [];
    for (const cookie of [undefined, 'admin_session=', 'admin_session=bad-token', 'admin_session']) {
      const response = await getCurrentAdmin(baseUrl, cookie);
      responses.push({
        status: response.status,
        body: await response.json(),
      });
    }

    assert.deepEqual(responses, Array.from({ length: 4 }, () => ({
      status: 401,
      body: {
        error: {
          code: 'INVALID_SESSION',
          message: 'Authentication required.',
        },
      },
    })));
    assert.equal(calls.lookup.length, 0);
    assert.equal(calls.update.length, 0);
    assert.equal(JSON.stringify(logs).includes(sessionToken), false);
    assert.equal(JSON.stringify(logs).includes(sessionTokenHash), false);
  });
});

test('unknown, revoked, expired, and inactive-admin sessions are rejected uniformly', async () => {
  const invalidSessions = [
    null,
    { revokedAt: new Date() },
    { expiresAt: new Date(Date.now() - 1) },
    { adminUser: { ...admin, isActive: false } },
    { adminUser: null },
  ];

  const responses = [];
  for (const invalidSession of invalidSessions) {
    const fixture = createMeTestApp({
      session: invalidSession === null
        ? null
        : {
          id: 'session-id',
          tokenHash: sessionTokenHash,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          lastSeenAt: null,
          adminUser: admin,
          ...invalidSession,
        },
    });

    await withServer(fixture.app, async (baseUrl) => {
      const response = await getCurrentAdmin(baseUrl, `admin_session=${sessionToken}`);
      responses.push({
        status: response.status,
        body: await response.json(),
      });
    });
    assert.equal(fixture.calls.update.length, 0);
  }

  assert.deepEqual(responses, Array.from({ length: invalidSessions.length }, () => ({
    status: 401,
    body: {
      error: {
        code: 'INVALID_SESSION',
        message: 'Authentication required.',
      },
    },
  })));
});

test('database lookup failure returns a safe server error and logs no token material', async (t) => {
  const diagnostic = 'private database diagnostic';
  const logs = captureErrorLogs(t);
  const { app } = createMeTestApp({ findUniqueError: new Error(diagnostic) });

  await withServer(app, async (baseUrl) => {
    const response = await getCurrentAdmin(baseUrl, `admin_session=${sessionToken}`);
    const responseText = await response.text();

    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(responseText), {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
    assert.equal(responseText.includes(diagnostic), false);
    assert.equal(JSON.stringify(logs).includes(diagnostic), false);
    assert.equal(JSON.stringify(logs).includes(sessionToken), false);
    assert.equal(JSON.stringify(logs).includes(sessionTokenHash), false);
  });
});

test('last-seen update failure returns a safe server error without exposing token material', async (t) => {
  const diagnostic = 'private update diagnostic';
  const logs = captureErrorLogs(t);
  const { app, calls } = createMeTestApp({ updateError: new Error(diagnostic) });

  await withServer(app, async (baseUrl) => {
    const response = await getCurrentAdmin(baseUrl, `admin_session=${sessionToken}`);
    const responseText = await response.text();

    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(responseText), {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
    assert.equal(responseText.includes(diagnostic), false);
    assert.equal(JSON.stringify(logs).includes(diagnostic), false);
    assert.equal(JSON.stringify(logs).includes(sessionToken), false);
    assert.equal(JSON.stringify(logs).includes(sessionTokenHash), false);
    assert.equal(calls.update.length, 1);
  });
});
