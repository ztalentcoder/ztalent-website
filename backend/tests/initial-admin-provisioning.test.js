import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionInitialAdmin } from '../src/services/initial-admin-provisioning.js';
import { verifyPassword } from '../src/utils/password.js';

function createPrismaStub({ count = 0 } = {}) {
  const calls = { transactionOptions: null, createArgs: null };
  const prisma = {
    async $transaction(callback, options) {
      calls.transactionOptions = options;
      return callback({
        adminUser: {
          async count() {
            return count;
          },
          async create(args) {
            calls.createArgs = args;
            return {
              id: 'temporary-admin-id',
              username: args.data.username,
              name: args.data.name,
              email: args.data.email,
              role: args.data.role,
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            };
          },
        },
      });
    },
  };
  return { prisma, calls };
}

test('provisions a normalized SUPER_ADMIN with a password hash and serializable transaction', async () => {
  const { prisma, calls } = createPrismaStub();
  const admin = await provisionInitialAdmin(prisma, {
    name: '  Initial Admin  ',
    email: '  Admin@Example.COM ',
    password: 'a-strong-initial-password',
  });

  assert.deepEqual(admin, {
    id: 'temporary-admin-id',
    username: 'admin',
    name: 'Initial Admin',
    email: 'admin@example.com',
    role: 'SUPER_ADMIN',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
  assert.equal(await verifyPassword('a-strong-initial-password', calls.createArgs.data.passwordHash), true);
  assert.equal(calls.createArgs.data.role, 'SUPER_ADMIN');
  assert.equal('passwordHash' in admin, false);
  assert.deepEqual(calls.transactionOptions, { isolationLevel: 'Serializable' });
});

test('refuses initial provisioning when any admin already exists', async () => {
  const { prisma, calls } = createPrismaStub({ count: 1 });
  await assert.rejects(
    provisionInitialAdmin(prisma, {
      name: 'Another Admin',
      email: 'admin@example.com',
      password: 'a-strong-initial-password',
    }),
    { code: 'ADMIN_ALREADY_EXISTS' },
  );
  assert.equal(calls.createArgs, null);
});

test('rejects invalid names, emails, and weak passwords before writing', async () => {
  const { prisma, calls } = createPrismaStub();
  const cases = [
    { name: ' ', email: 'admin@example.com', password: 'a-strong-initial-password' },
    { name: 'Initial Admin', email: 'not-an-email', password: 'a-strong-initial-password' },
    { name: 'Initial Admin', email: 'admin@example.com', password: 'short' },
  ];

  for (const input of cases) {
    await assert.rejects(provisionInitialAdmin(prisma, input), { code: 'INVALID_INPUT' });
  }
  assert.equal(calls.createArgs, null);
});
