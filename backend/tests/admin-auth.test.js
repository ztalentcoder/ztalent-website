import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createApp, createPrismaStub, withServer } from './helpers.js';
import { hashPassword } from '../src/utils/password.js';

const password = '  unchanged password  ';
const passwordHash = await hashPassword(password);
const admin = {
  id: 'admin-id',
  username: 'admin',
  name: 'Admin User',
  email: 'admin@example.com',
  passwordHash,
  role: 'SUPER_ADMIN',
  isActive: true,
};

function createLoginTestApp({
  account = admin,
  findUnique = async () => account,
  findUniqueError,
  transactionError,
  adminLoginRateLimit,
} = {}) {
  const calls = {
    findUnique: [],
    sessionCreate: [],
    adminUpdate: [],
    transaction: 0,
  };
  const prismaClient = {
    ...createPrismaStub(),
    adminUser: {
      findUnique: async (args) => {
        calls.findUnique.push(args);
        if (findUniqueError) throw findUniqueError;
        return findUnique(args);
      },
    },
    $transaction: async (callback) => {
      calls.transaction += 1;
      if (transactionError) throw transactionError;
      return callback({
        adminSession: {
          create: async (args) => {
            calls.sessionCreate.push(args);
            return { id: 'session-id' };
          },
        },
        adminUser: {
          update: async (args) => {
            calls.adminUpdate.push(args);
            return {};
          },
        },
      });
    },
  };

  return {
    app: createApp({ prismaClient, adminLoginRateLimit }),
    calls,
  };
}

async function postLogin(baseUrl, body, headers = {}) {
  return fetch(`${baseUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function getCookieParts(response) {
  const [cookiePair, ...attributes] = response.headers.getSetCookie()[0].split(';').map((part) => part.trim());
  const [name, value] = cookiePair.split('=');
  return { name, value, attributes };
}

function captureErrorLogs(t) {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  return logs;
}

test('successful login creates a hashed-token session and returns safe admin information', async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const logs = captureErrorLogs(t);
  const { app, calls } = createLoginTestApp();

  try {
    await withServer(app, async (baseUrl) => {
      const response = await postLogin(
        baseUrl,
        { email: '  ADMIN@Example.COM  ', password },
        { 'User-Agent': 'Admin test client' },
      );
      const responseText = await response.text();
      const body = JSON.parse(responseText);
      const { name: cookieName, value: token, attributes } = getCookieParts(response);
      const storedSession = calls.sessionCreate[0].data;
      const expectedTokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
      const lastLoginAt = calls.adminUpdate[0].data.lastLoginAt;

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        status: 'success',
        admin: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      });
      assert.equal(responseText.includes(passwordHash), false);
      assert.equal(responseText.includes(password), false);
      assert.equal(cookieName, 'admin_session');
      assert.match(token, /^[a-f0-9]{64}$/);
      assert.ok(attributes.includes('Path=/api'));
      assert.ok(attributes.includes('HttpOnly'));
      assert.ok(attributes.includes('SameSite=Lax'));
      assert.equal(attributes.includes('Secure'), false);
      assert.equal(responseText.includes(token), false);
      assert.deepEqual(calls.findUnique, [{ where: { email: admin.email } }]);
      assert.equal(calls.transaction, 1);
      assert.deepEqual(storedSession, {
        adminUserId: admin.id,
        tokenHash: expectedTokenHash,
        expiresAt: storedSession.expiresAt,
        lastSeenAt: lastLoginAt,
        userAgent: 'Admin test client',
      });
      assert.equal(storedSession.tokenHash.length, 64);
      assert.notEqual(storedSession.tokenHash, token);
      assert.equal(storedSession.expiresAt.getTime() - lastLoginAt.getTime(), 8 * 60 * 60 * 1000);
      assert.deepEqual(calls.adminUpdate, [{
        where: { id: admin.id },
        data: { lastLoginAt },
      }]);
      assert.deepEqual(logs, []);
    });
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test('unknown, incorrect-password, and inactive-account failures use one generic response', async (t) => {
  const logs = captureErrorLogs(t);
  const { app, calls } = createLoginTestApp({
    findUnique: async ({ where }) => where.email === 'missing@example.com'
      ? null
      : where.email === 'inactive@example.com'
        ? { ...admin, email: where.email, isActive: false }
        : admin,
  });

  await withServer(app, async (baseUrl) => {
    const responses = [];
    for (const [email, attemptPassword] of [
      ['missing@example.com', password],
      [admin.email, 'wrong password'],
      ['inactive@example.com', password],
    ]) {
      const response = await postLogin(baseUrl, { email, password: attemptPassword });
      responses.push({
        status: response.status,
        body: await response.json(),
        cookie: response.headers.get('set-cookie'),
      });
    }

    assert.deepEqual(responses, [
      {
        status: 401,
        body: {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email, username, or password.',
          },
        },
        cookie: null,
      },
      {
        status: 401,
        body: {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email, username, or password.',
          },
        },
        cookie: null,
      },
      {
        status: 401,
        body: {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email, username, or password.',
          },
        },
        cookie: null,
      },
    ]);
    assert.equal(calls.transaction, 0);
    assert.equal(JSON.stringify(logs).includes(password), false);
    assert.equal(JSON.stringify(logs).includes(passwordHash), false);
  });
});

test('missing, empty, malformed, and unexpected login fields return HTTP 400', async () => {
  const { app, calls } = createLoginTestApp({
    adminLoginRateLimit: { limit: 20, windowMs: 60_000 },
  });
  const invalidPayloads = [
    null,
    [],
    {},
    { email: 'admin@example.com' },
    { password },
    { identifier: 'invalid username!', password },
    { email: 123, password },
    { email: 'admin@example.com', password: 123 },
    { email: '', password },
    { email: 'not-an-email', password },
    { email: 'admin@example.com', password: '' },
    { email: 'admin@example.com', password, role: 'SUPER_ADMIN' },
  ];

  await withServer(app, async (baseUrl) => {
    for (const payload of invalidPayloads) {
      const response = await postLogin(baseUrl, payload);
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.ok(['INVALID_JSON', 'VALIDATION_ERROR'].includes(body.error.code));
    }
  });

  test('login accepts an administrator username while preserving email login', async () => {
    const { app, calls } = createLoginTestApp();
    await withServer(app, async (baseUrl) => {
      const response = await postLogin(baseUrl, { identifier: ' ADMIN ', password });
      assert.equal(response.status, 200);
      assert.deepEqual(calls.findUnique, [{ where: { username: 'admin' } }]);
    });
  });

  assert.equal(calls.findUnique.length, 0);
});

test('database failures return a generic server error without exposing diagnostics', async (t) => {
  const diagnostic = 'private database diagnostic';
  const logs = captureErrorLogs(t);
  const { app } = createLoginTestApp({ findUniqueError: new Error(diagnostic) });

  await withServer(app, async (baseUrl) => {
    const response = await postLogin(baseUrl, { email: admin.email, password });
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
    assert.equal(JSON.stringify(logs).includes(password), false);
  });
});

test('transaction failure does not issue the session cookie or return success', async (t) => {
  const logs = captureErrorLogs(t);
  const { app } = createLoginTestApp({ transactionError: new Error('transaction failed') });

  await withServer(app, async (baseUrl) => {
    const response = await postLogin(baseUrl, { email: admin.email, password });

    assert.equal(response.status, 500);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
    assert.equal(JSON.stringify(logs).includes(password), false);
  });
});

test('login attempts are limited to five per IP within the configured window', async () => {
  const { app, calls } = createLoginTestApp();

  await withServer(app, async (baseUrl) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await postLogin(baseUrl, {});
      assert.equal(response.status, 400);
    }

    const limitedResponse = await postLogin(baseUrl, {});
    assert.equal(limitedResponse.status, 429);
    assert.deepEqual(await limitedResponse.json(), {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please try again later.',
      },
    });
    assert.equal(calls.findUnique.length, 0);
  });
});
