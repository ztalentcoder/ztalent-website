import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from './helpers.js';
import { withServer } from './helpers.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { hashSessionToken } from '../src/utils/session-token.js';

const sessionToken = 'e'.repeat(64);
const sessionTokenHash = hashSessionToken(sessionToken);
const currentAdmin = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'primary.admin',
  name: 'Primary Admin',
  email: 'primary@example.test',
  role: 'SUPER_ADMIN',
  isActive: true,
};
const assistantAdmin = {
  id: '00000000-0000-4000-8000-000000000002',
  username: 'assistant.one',
  name: 'assistant.one',
  email: null,
  role: 'ASSISTANT_ADMIN',
  isActive: true,
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  lastLoginAt: null,
};

async function createFixture({ role = 'SUPER_ADMIN' } = {}) {
  const passwordHash = await hashPassword('correct-current-password');
  const admins = [{ ...currentAdmin, role, passwordHash }, { ...assistantAdmin, passwordHash }];
  const sessions = [
    { id: 'current-session', adminUserId: currentAdmin.id, tokenHash: sessionTokenHash, revokedAt: null },
    { id: 'other-session', adminUserId: currentAdmin.id, tokenHash: 'f'.repeat(64), revokedAt: null },
    { id: 'assistant-session', adminUserId: assistantAdmin.id, tokenHash: 'a'.repeat(64), revokedAt: null },
  ];
  const calls = { adminUpdateMany: [], sessionUpdateMany: [], created: [] };
  const prisma = {
    adminSession: {
      findUnique: async ({ where }) => {
        const session = sessions.find((entry) => entry.tokenHash === where.tokenHash);
        if (!session) return null;
        return {
          ...session,
          expiresAt: new Date(Date.now() + 60_000),
          adminUser: { ...admins.find((entry) => entry.id === session.adminUserId) },
        };
      },
      update: async () => ({}),
      updateMany: async ({ where, data }) => {
        calls.sessionUpdateMany.push({ where, data });
        let count = 0;
        for (const session of sessions) {
          if (
            (!where.adminUserId || session.adminUserId === where.adminUserId)
            && (!where.id || (where.id.not ? session.id !== where.id.not : session.id === where.id))
            && (where.revokedAt === null ? session.revokedAt === null : true)
          ) {
            session.revokedAt = data.revokedAt;
            count += 1;
          }
        }
        return { count };
      },
    },
    adminUser: {
      findUnique: async ({ where }) => admins.find((entry) => (
        (where.id && entry.id === where.id)
        || (where.username && entry.username === where.username)
      )) ?? null,
      findMany: async () => admins.map(({ passwordHash: _passwordHash, ...entry }) => ({ ...entry })),
      create: async ({ data }) => {
        if (admins.some((entry) => entry.username === data.username)) {
          throw Object.assign(new Error('duplicate'), { code: 'P2002' });
        }
        const created = {
          id: '00000000-0000-4000-8000-000000000003',
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
          lastLoginAt: null,
          ...data,
        };
        admins.push(created);
        calls.created.push(created);
        return created;
      },
      update: async ({ where, data }) => {
        const admin = admins.find((entry) => entry.id === where.id);
        if (!admin) throw Object.assign(new Error('missing'), { code: 'P2025' });
        Object.assign(admin, data);
        return admin;
      },
      updateMany: async ({ where, data }) => {
        calls.adminUpdateMany.push({ where, data });
        const admin = admins.find((entry) => entry.id === where.id);
        if (!admin || admin.passwordHash !== where.passwordHash) return { count: 0 };
        Object.assign(admin, data);
        return { count: 1 };
      },
    },
    $transaction: async (callback) => callback(prisma),
  };
  const app = createApp({ prismaClient: prisma, frontendOrigin: 'http://frontend.test' });
  return { app, admins, sessions, calls };
}

function headers(body) {
  return {
    Cookie: `admin_session=${sessionToken}`,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  };
}

test('authenticated administrators can update their username with current-password verification', async () => {
  const { app, admins } = await createFixture();
  await withServer(app, async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/api/admin/account/username`, {
      method: 'PATCH',
      headers: headers({}),
      body: JSON.stringify({ username: 'new.admin', currentPassword: 'wrong-password' }),
    });
    assert.equal(invalid.status, 401);

    const updated = await fetch(`${baseUrl}/api/admin/account/username`, {
      method: 'PATCH',
      headers: headers({}),
      body: JSON.stringify({ username: 'New.Admin', currentPassword: 'correct-current-password' }),
    });
    assert.equal(updated.status, 200);
    assert.deepEqual((await updated.json()).admin, {
      id: currentAdmin.id,
      username: 'new.admin',
      name: currentAdmin.name,
      email: currentAdmin.email,
      role: 'SUPER_ADMIN',
    });
    assert.equal(admins[0].username, 'new.admin');
  });
});

test('password changes require valid current credentials, hash the new password, and revoke other sessions', async () => {
  const { app, admins, sessions, calls } = await createFixture();
  await withServer(app, async (baseUrl) => {
    const wrongPassword = await fetch(`${baseUrl}/api/admin/account/password`, {
      method: 'PATCH',
      headers: headers({}),
      body: JSON.stringify({
        currentPassword: 'wrong-password',
        newPassword: 'a-new-password-longer-than-twelve',
        confirmPassword: 'a-new-password-longer-than-twelve',
      }),
    });
    assert.equal(wrongPassword.status, 401);

    const changed = await fetch(`${baseUrl}/api/admin/account/password`, {
      method: 'PATCH',
      headers: headers({}),
      body: JSON.stringify({
        currentPassword: 'correct-current-password',
        newPassword: 'a-new-password-longer-than-twelve',
        confirmPassword: 'a-new-password-longer-than-twelve',
      }),
    });
    assert.equal(changed.status, 200);
    const body = await changed.json();
    assert.equal(JSON.stringify(body).includes(admins[0].passwordHash), false);
    assert.equal(await verifyPassword('a-new-password-longer-than-twelve', admins[0].passwordHash), true);
    assert.equal(sessions[0].revokedAt, null);
    assert.ok(sessions[1].revokedAt instanceof Date);
    assert.deepEqual(calls.sessionUpdateMany[0].where, {
      adminUserId: currentAdmin.id,
      id: { not: 'current-session' },
      revokedAt: null,
    });
  });
});

test('Super Admins can create assistants and protect Super Admin accounts from management', async () => {
  const { app, admins, calls } = await createFixture();
  await withServer(app, async (baseUrl) => {
    const created = await fetch(`${baseUrl}/api/admin/administrators`, {
      method: 'POST',
      headers: headers({}),
      body: JSON.stringify({
        username: 'new.assistant',
        newPassword: 'a-new-assistant-password',
        confirmPassword: 'a-new-assistant-password',
      }),
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).administrator.role, 'ASSISTANT_ADMIN');
    assert.equal(await verifyPassword('a-new-assistant-password', calls.created[0].passwordHash), true);
    assert.equal(calls.created[0].email, null);

    const protectedAccount = await fetch(
      `${baseUrl}/api/admin/administrators/${currentAdmin.id}/status`,
      {
        method: 'PATCH',
        headers: headers({}),
        body: JSON.stringify({ isActive: false }),
      },
    );
    assert.equal(protectedAccount.status, 403);
    assert.equal(admins[0].isActive, true);
  });
});

test('administrator creation rejects duplicate usernames and unconfirmed passwords', async () => {
  const { app, calls } = await createFixture();
  await withServer(app, async (baseUrl) => {
    const duplicate = await fetch(`${baseUrl}/api/admin/administrators`, {
      method: 'POST',
      headers: headers({}),
      body: JSON.stringify({
        username: 'assistant.one',
        newPassword: 'a-new-assistant-password',
        confirmPassword: 'a-new-assistant-password',
      }),
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, 'DUPLICATE_USERNAME');

    const mismatch = await fetch(`${baseUrl}/api/admin/administrators`, {
      method: 'POST',
      headers: headers({}),
      body: JSON.stringify({
        username: 'another.assistant',
        newPassword: 'a-new-assistant-password',
        confirmPassword: 'a-different-assistant-password',
      }),
    });
    assert.equal(mismatch.status, 400);
    assert.equal(calls.created.length, 0);

    const unauthorized = await fetch(`${baseUrl}/api/admin/administrators`);
    assert.equal(unauthorized.status, 401);
  });
});

test('assistant administrators are denied administrator listing and creation on the backend', async () => {
  const { app } = await createFixture({ role: 'ASSISTANT_ADMIN' });
  await withServer(app, async (baseUrl) => {
    for (const [url, method, body] of [
      ['/api/admin/administrators', 'GET'],
      ['/api/admin/administrators', 'POST', { username: 'unauthorized', newPassword: 'long-password-123', confirmPassword: 'long-password-123' }],
    ]) {
      const response = await fetch(`${baseUrl}${url}`, {
        method,
        headers: headers(body),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      assert.equal(response.status, 403);
    }
  });
});
