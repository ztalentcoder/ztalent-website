import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { withServer } from './helpers.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requireAdminAuth } from '../src/middleware/require-admin-auth.js';
import { requireAdminRole } from '../src/middleware/require-admin-role.js';

async function createRoleApp({ admin, roles }) {
  const app = express();
  app.get('/protected', (request, _response, next) => {
    request.admin = admin;
    next();
  }, requireAdminRole(...roles), (request, response) => {
    response.json({ admin: request.admin });
  });
  app.use(errorHandler);
  return app;
}

async function getProtected(baseUrl) {
  return fetch(`${baseUrl}/protected`);
}

test('role authorization allows any explicitly permitted role', async () => {
  for (const role of ['SUPER_ADMIN', 'EDITOR']) {
    const app = await createRoleApp({
      admin: { id: 'admin-id', role },
      roles: ['SUPER_ADMIN', 'EDITOR'],
    });

    await withServer(app, async (baseUrl) => {
      const response = await getProtected(baseUrl);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        admin: { id: 'admin-id', role },
      });
    });
  }
});

test('role authorization denies users without an allowed role', async () => {
  const app = await createRoleApp({
    admin: { id: 'admin-id', role: 'EDITOR' },
    roles: ['SUPER_ADMIN'],
  });

  await withServer(app, async (baseUrl) => {
    const response = await getProtected(baseUrl);

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'FORBIDDEN',
        message: 'You are not authorized to access this resource.',
      },
    });
  });
});

test('role authorization rejects requests without authenticated admin information', async () => {
  const app = await createRoleApp({ roles: ['SUPER_ADMIN'] });

  await withServer(app, async (baseUrl) => {
    const response = await getProtected(baseUrl);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'INVALID_SESSION',
        message: 'Authentication required.',
      },
    });
  });
});

test('authenticated route pattern verifies session before role authorization', async () => {
  const app = express();
  app.locals.prisma = {
    adminSession: {
      findUnique: async () => ({
        id: 'session-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        adminUser: {
          id: 'admin-id',
          name: 'Admin',
          email: 'admin@example.com',
          role: 'EDITOR',
          isActive: true,
        },
      }),
      update: async () => ({}),
    },
  };
  app.get('/protected', requireAdminAuth, requireAdminRole('SUPER_ADMIN'), (_request, response) => {
    response.sendStatus(204);
  });
  app.use(errorHandler);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Cookie: `admin_session=${'d'.repeat(64)}` },
    });

    assert.equal(response.status, 403);
  });
});
