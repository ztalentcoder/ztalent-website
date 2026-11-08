import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp, createPrismaStub, withServer } from './helpers.js';
import { hashSessionToken } from '../src/utils/session-token.js';

const sessionToken = 'b'.repeat(64);
const sessionTokenHash = hashSessionToken(sessionToken);

function createLogoutTestApp({
  session = { id: 'session-id', revokedAt: null },
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
      updateMany: async (args) => {
        calls.update.push(args);
        if (updateError) throw updateError;
        if (session?.revokedAt === null) {
          session.revokedAt = args.data.revokedAt;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
  };

  return {
    app: createApp({ prismaClient }),
    calls,
    session,
  };
}

async function postLogout(baseUrl, cookie) {
  return fetch(`${baseUrl}/api/admin/auth/logout`, {
    method: 'POST',
    headers: cookie === undefined ? {} : { Cookie: cookie },
  });
}

function parseSetCookie(response) {
  const [cookiePair, ...attributeParts] = response.headers.getSetCookie()[0]
    .split(';')
    .map((part) => part.trim());
  const attributes = new Map(attributeParts.map((part) => {
    const separatorIndex = part.indexOf('=');
    return separatorIndex === -1
      ? [part.toLowerCase(), true]
      : [part.slice(0, separatorIndex).toLowerCase(), part.slice(separatorIndex + 1)];
  }));
  const [name, value] = cookiePair.split('=');

  return { name, value, attributes };
}

function captureErrorLogs(t) {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  return logs;
}

test('valid logout revokes only the matching session and clears its cookie', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const fixture = createLogoutTestApp();

  try {
    await withServer(fixture.app, async (baseUrl) => {
      const response = await postLogout(baseUrl, `admin_session=${sessionToken}`);
      const { name, value, attributes } = parseSetCookie(response);
      const bodyText = await response.text();

      assert.equal(response.status, 200);
      assert.deepEqual(JSON.parse(bodyText), {
        status: 'success',
        message: 'Logged out successfully.',
      });
      assert.equal(bodyText.includes(sessionToken), false);
      assert.deepEqual(fixture.calls.lookup, [{
        where: { tokenHash: sessionTokenHash },
        select: { id: true, revokedAt: true },
      }]);
      assert.equal(fixture.calls.update.length, 1);
      assert.deepEqual(fixture.calls.update[0].where, {
        id: 'session-id',
        revokedAt: null,
      });
      assert.ok(fixture.calls.update[0].data.revokedAt instanceof Date);
      assert.ok(Math.abs(Date.now() - fixture.calls.update[0].data.revokedAt.getTime()) < 5_000);
      assert.equal(fixture.session.revokedAt, fixture.calls.update[0].data.revokedAt);
      assert.equal(name, 'admin_session');
      assert.equal(value, '');
      assert.equal(attributes.get('path'), '/api');
      assert.equal(attributes.get('httponly'), true);
      assert.equal(attributes.get('samesite'), 'Lax');
      assert.equal(attributes.has('secure'), false);
      assert.equal(attributes.has('domain'), false);
      assert.ok(Date.parse(attributes.get('expires')) < Date.now());
    });
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test('logout is safe and clears the cookie for absent, invalid, and inactive sessions', async () => {
  const cases = [
    { cookie: undefined, session: null, shouldLookup: false, shouldUpdate: false },
    { cookie: 'admin_session=', session: null, shouldLookup: false, shouldUpdate: false },
    {
      cookie: 'admin_session=malformed-token',
      session: null,
      shouldLookup: true,
      shouldUpdate: false,
      expectedHash: hashSessionToken('malformed-token'),
    },
    { cookie: `admin_session=${sessionToken}`, session: null, shouldLookup: true, shouldUpdate: false },
    {
      cookie: `admin_session=${sessionToken}`,
      session: { id: 'revoked-id', revokedAt: new Date() },
      shouldLookup: true,
      shouldUpdate: false,
    },
    {
      cookie: `admin_session=${sessionToken}`,
      session: { id: 'expired-id', revokedAt: null, expiresAt: new Date(0) },
      shouldLookup: true,
      shouldUpdate: true,
    },
  ];

  for (const testCase of cases) {
    const fixture = createLogoutTestApp({ session: testCase.session });

    await withServer(fixture.app, async (baseUrl) => {
      const response = await postLogout(baseUrl, testCase.cookie);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        status: 'success',
        message: 'Logged out successfully.',
      });
      const { name, value, attributes } = parseSetCookie(response);
      assert.equal(name, 'admin_session');
      assert.equal(value, '');
      assert.equal(attributes.get('path'), '/api');
      assert.ok(Date.parse(attributes.get('expires')) < Date.now());
    });

    assert.equal(fixture.calls.lookup.length, testCase.shouldLookup ? 1 : 0);
    if (testCase.shouldLookup) {
      assert.deepEqual(fixture.calls.lookup[0], {
        where: { tokenHash: testCase.expectedHash ?? sessionTokenHash },
        select: { id: true, revokedAt: true },
      });
    }
    assert.equal(fixture.calls.update.length, testCase.shouldUpdate ? 1 : 0);
  }
});

test('repeated logout is idempotent and does not update an already-revoked session', async () => {
  const fixture = createLogoutTestApp();

  await withServer(fixture.app, async (baseUrl) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await postLogout(baseUrl, `admin_session=${sessionToken}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        status: 'success',
        message: 'Logged out successfully.',
      });
    }
  });

  assert.equal(fixture.calls.lookup.length, 2);
  assert.equal(fixture.calls.update.length, 1);
});

test('logout cookie clearing preserves secure-mode attributes in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const fixture = createLogoutTestApp();

  try {
    await withServer(fixture.app, async (baseUrl) => {
      const response = await postLogout(baseUrl);
      const { name, value, attributes } = parseSetCookie(response);

      assert.equal(response.status, 200);
      assert.equal(name, 'admin_session');
      assert.equal(value, '');
      assert.equal(attributes.get('path'), '/api');
      assert.equal(attributes.get('httponly'), true);
      assert.equal(attributes.get('samesite'), 'Lax');
      assert.equal(attributes.has('secure'), true);
      assert.equal(attributes.has('domain'), false);
      assert.ok(Date.parse(attributes.get('expires')) < Date.now());
    });
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

for (const [failure, option] of [
  ['lookup', 'findUniqueError'],
  ['update', 'updateError'],
]) {
  test(`logout ${failure} failure returns sanitized 500 and does not clear the cookie`, async (t) => {
    const diagnostic = `private ${failure} diagnostic`;
    const logs = captureErrorLogs(t);
    const fixture = createLogoutTestApp({ [option]: new Error(diagnostic) });

    await withServer(fixture.app, async (baseUrl) => {
      const response = await postLogout(baseUrl, `admin_session=${sessionToken}`);
      const bodyText = await response.text();

      assert.equal(response.status, 500);
      assert.deepEqual(JSON.parse(bodyText), {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
      assert.equal(response.headers.get('set-cookie'), null);
      assert.equal(bodyText.includes(diagnostic), false);
      assert.equal(bodyText.includes(sessionToken), false);
      assert.equal(JSON.stringify(logs).includes(diagnostic), false);
      assert.equal(JSON.stringify(logs).includes(sessionToken), false);
      assert.equal(JSON.stringify(logs).includes(sessionTokenHash), false);
    });
  });
}
