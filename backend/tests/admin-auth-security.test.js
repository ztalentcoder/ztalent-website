import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import express from 'express';
import { withServer } from './helpers.js';
import {
  ADMIN_SESSION_COOKIE_NAME,
  clearAdminSessionCookie,
  setAdminSessionCookie,
} from '../src/utils/admin-session-cookie.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { generateSessionToken, hashSessionToken } from '../src/utils/session-token.js';

test('password hashes use Argon2id with the configured security parameters', async () => {
  const passwordHash = await hashPassword('correct horse battery staple');

  assert.match(passwordHash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
});

test('password verification accepts the correct password', async () => {
  const passwordHash = await hashPassword('correct horse battery staple');

  assert.equal(await verifyPassword('correct horse battery staple', passwordHash), true);
});

test('password verification rejects an incorrect password', async () => {
  const passwordHash = await hashPassword('correct horse battery staple');

  assert.equal(await verifyPassword('incorrect password', passwordHash), false);
});

test('password verification safely rejects invalid hashes', async () => {
  assert.equal(await verifyPassword('any password', 'not-an-argon2-hash'), false);
});

test('password operations do not log passwords, hashes, or malformed-hash errors', async (t) => {
  const loggedCalls = captureConsoleCalls(t);
  const password = 'sensitive password';
  const passwordHash = await hashPassword(password);

  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('wrong password', passwordHash), false);
  assert.equal(await verifyPassword(password, 'malformed hash'), false);
  assert.deepEqual(loggedCalls, []);
});

test('password hashes use independent salts', async () => {
  const firstHash = await hashPassword('same password');
  const secondHash = await hashPassword('same password');

  assert.notEqual(firstHash, secondHash);
});

test('session tokens are random 32-byte values encoded as hexadecimal', () => {
  const firstToken = generateSessionToken();
  const secondToken = generateSessionToken();

  assert.match(firstToken, /^[a-f0-9]{64}$/);
  assert.equal(Buffer.from(firstToken, 'hex').length, 32);
  assert.notEqual(firstToken, secondToken);
});

test('session token hashing returns the SHA-256 digest without changing the token', () => {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expectedHash = createHash('sha256').update(token, 'utf8').digest('hex');

  assert.equal(tokenHash, expectedHash);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(tokenHash, token);
});

test('session token operations do not log raw tokens or hashes', (t) => {
  const loggedCalls = captureConsoleCalls(t);
  const token = generateSessionToken();

  hashSessionToken(token);

  assert.deepEqual(loggedCalls, []);
});

function captureConsoleCalls(t) {
  const calls = [];
  for (const method of ['debug', 'info', 'log', 'warn', 'error']) {
    t.mock.method(console, method, (...args) => calls.push({ method, args }));
  }
  return calls;
}

function createCookieTestApp() {
  const app = express();

  app.get('/set-cookie', (request, response) => {
    setAdminSessionCookie(response, generateSessionToken());
    response.end();
  });
  app.get('/clear-cookie', (request, response) => {
    clearAdminSessionCookie(response);
    response.end();
  });

  return app;
}

function parseSetCookie(header) {
  const [cookiePair, ...attributeParts] = header.split(';').map((part) => part.trim());
  const attributes = new Map(
    attributeParts.map((part) => {
      const separatorIndex = part.indexOf('=');
      return separatorIndex === -1
        ? [part.toLowerCase(), true]
        : [part.slice(0, separatorIndex).toLowerCase(), part.slice(separatorIndex + 1)];
    }),
  );

  return { cookiePair, attributes };
}

function assertCookieSecurityAttributes(header, secure) {
  const { attributes } = parseSetCookie(header);

  assert.equal(attributes.get('httponly'), true);
  assert.equal(attributes.get('samesite'), 'Lax');
  assert.equal(attributes.get('path'), '/api');
  assert.equal(attributes.has('secure'), secure);
  assert.equal(attributes.has('domain'), false);
}

for (const [environment, secure] of [['development', false], ['production', true]]) {
  test(`serialized ${environment} session cookie has secure session attributes`, async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = environment;

    try {
      await withServer(createCookieTestApp(), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/set-cookie`);
        const setCookieHeaders = response.headers.getSetCookie();
        const { cookiePair, attributes } = parseSetCookie(setCookieHeaders[0]);
        const [cookieName, cookieValue] = cookiePair.split('=');

        assert.equal(response.status, 200);
        assert.equal(await response.text(), '');
        assert.equal(setCookieHeaders.length, 1);
        assert.equal(cookieName, ADMIN_SESSION_COOKIE_NAME);
        assert.match(cookieValue, /^[a-f0-9]{64}$/);
        assertCookieSecurityAttributes(setCookieHeaders[0], secure);
        assert.equal(attributes.has('max-age'), false);
        assert.equal(attributes.has('expires'), false);
      });
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  test(`serialized ${environment} cookie clearing matches attributes and expires the cookie`, async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = environment;

    try {
      await withServer(createCookieTestApp(), async (baseUrl) => {
        const creationResponse = await fetch(`${baseUrl}/set-cookie`);
        const clearingResponse = await fetch(`${baseUrl}/clear-cookie`);
        const creationHeader = creationResponse.headers.getSetCookie()[0];
        const clearingHeaders = clearingResponse.headers.getSetCookie();
        const { cookiePair: creationPair } = parseSetCookie(creationHeader);
        const { cookiePair: clearingPair, attributes: clearingAttributes } = parseSetCookie(clearingHeaders[0]);
        const [creationName] = creationPair.split('=');
        const [clearingName, clearingValue] = clearingPair.split('=');
        const expires = Date.parse(clearingAttributes.get('expires'));

        assert.equal(clearingResponse.status, 200);
        assert.equal(clearingHeaders.length, 1);
        assert.equal(creationName, ADMIN_SESSION_COOKIE_NAME);
        assert.equal(clearingName, creationName);
        assert.equal(clearingValue, '');
        assertCookieSecurityAttributes(creationHeader, secure);
        assertCookieSecurityAttributes(clearingHeaders[0], secure);
        assert.equal(clearingAttributes.get('path'), parseSetCookie(creationHeader).attributes.get('path'));
        assert.equal(clearingAttributes.has('max-age'), false);
        assert.ok(Number.isFinite(expires));
        assert.ok(expires < Date.now());
      });
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });
}
