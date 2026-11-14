import { Router } from 'express';
import { requireAdminAuth } from '../middleware/require-admin-auth.js';
import { requireAdminRole } from '../middleware/require-admin-role.js';
import { HttpError } from '../utils/http-error.js';
import { getAdminSessionToken } from '../utils/admin-session-cookie.js';
import { hashSessionToken } from '../utils/session-token.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { requireAdminUsername } from '../validators/admin-username.js';

const ASSISTANT_ROLES = ['ASSISTANT_ADMIN', 'EDITOR'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PASSWORD_LENGTH = 1024;
const ADMIN_SELECT = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
};
const MANAGED_ADMIN_SELECT = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
};

function invalid(message) {
  throw new HttpError(400, 'VALIDATION_ERROR', message);
}

function invalidSession() {
  return new HttpError(401, 'INVALID_SESSION', 'Authentication required.');
}

function parseObject(payload, allowedFields) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    invalid('Request body must be a JSON object.');
  }
  if (Object.keys(payload).some((field) => !allowedFields.includes(field))) {
    invalid('Request contains unexpected properties.');
  }
  return payload;
}

function parsePassword(value, label) {
  if (typeof value !== 'string' || value.length < 12 || value.length > MAX_PASSWORD_LENGTH) {
    invalid(`${label} must be between 12 and ${MAX_PASSWORD_LENGTH} characters.`);
  }
  return value;
}

function parsePasswordPair(payload, { requireCurrent = false } = {}) {
  const allowedFields = requireCurrent
    ? ['currentPassword', 'newPassword', 'confirmPassword']
    : ['newPassword', 'confirmPassword'];
  parseObject(payload, allowedFields);
  const currentPassword = payload.currentPassword;
  if (requireCurrent && (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > MAX_PASSWORD_LENGTH)) {
    invalid('Current password is required.');
  }
  const newPassword = parsePassword(payload.newPassword, 'New password');
  const confirmPassword = payload.confirmPassword;
  if (typeof confirmPassword !== 'string' || confirmPassword !== newPassword) {
    invalid('New password and confirmation must match.');
  }
  return { currentPassword, newPassword };
}

function serializeAdmin(admin) {
  return {
    id: admin.id,
    username: admin.username,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };
}

function serializeManagedAdmin(admin) {
  return {
    id: admin.id,
    username: admin.username,
    role: admin.role,
    isActive: admin.isActive,
    createdAt: admin.createdAt,
    lastLoginAt: admin.lastLoginAt,
  };
}

function assertAssistantRole(admin) {
  if (!ASSISTANT_ROLES.includes(admin.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Super Admin accounts cannot be managed here.');
  }
}

function parseAdminId(value) {
  if (!UUID_PATTERN.test(value)) {
    throw new HttpError(404, 'ADMIN_NOT_FOUND', 'The administrator account was not found.');
  }
  return value;
}

function accountNotFound() {
  return new HttpError(404, 'ADMIN_NOT_FOUND', 'The administrator account was not found.');
}

function mapAccountErrors(error, _request, _response, next) {
  if (error?.code === 'P2002') {
    next(new HttpError(409, 'DUPLICATE_USERNAME', 'That username is already in use.'));
    return;
  }
  if (error?.code === 'P2025') {
    next(accountNotFound());
    return;
  }
  next(error);
}

async function getCurrentSessionId(request, prisma) {
  const token = getAdminSessionToken(request);
  if (!token) throw invalidSession();
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { id: true, adminUserId: true, revokedAt: true, expiresAt: true },
  });
  if (
    !session ||
    session.adminUserId !== request.admin.id ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date()
  ) {
    throw invalidSession();
  }
  return session.id;
}

async function getAdminForPasswordVerification(prisma, adminId) {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { id: true, passwordHash: true },
  });
  if (!admin) throw invalidSession();
  return admin;
}

export function createAdminAccountsRouter() {
  const router = Router();
  router.use(requireAdminAuth);

  router.get('/account', (request, response) => {
    response.json({ status: 'success', admin: serializeAdmin(request.admin) });
  });

  router.patch('/account/username', async (request, response) => {
    const body = parseObject(request.body, ['username', 'currentPassword']);
    if (typeof body.currentPassword !== 'string' || !body.currentPassword || body.currentPassword.length > MAX_PASSWORD_LENGTH) {
      invalid('Current password is required.');
    }
    const username = requireAdminUsername(body.username);
    const prisma = request.app.locals.prisma;
    const currentAdmin = await getAdminForPasswordVerification(prisma, request.admin.id);
    if (!await verifyPassword(body.currentPassword, currentAdmin.passwordHash)) {
      throw new HttpError(401, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
    }
    const admin = await prisma.adminUser.update({
      where: { id: request.admin.id },
      data: { username },
      select: ADMIN_SELECT,
    });
    response.json({ status: 'success', admin: serializeAdmin(admin) });
  });

  router.patch('/account/password', async (request, response) => {
    const { currentPassword, newPassword } = parsePasswordPair(request.body, { requireCurrent: true });
    const prisma = request.app.locals.prisma;
    const currentAdmin = await getAdminForPasswordVerification(prisma, request.admin.id);
    if (!await verifyPassword(currentPassword, currentAdmin.passwordHash)) {
      throw new HttpError(401, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
    }
    if (await verifyPassword(newPassword, currentAdmin.passwordHash)) {
      invalid('Choose a new password that is different from your current password.');
    }

    const passwordHash = await hashPassword(newPassword);
    const currentSessionId = await getCurrentSessionId(request, prisma);
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const update = await transaction.adminUser.updateMany({
        where: { id: request.admin.id, passwordHash: currentAdmin.passwordHash },
        data: { passwordHash },
      });
      if (update.count !== 1) {
        throw new HttpError(409, 'CREDENTIALS_CHANGED', 'The account credentials changed. Sign in again and retry.');
      }
      await transaction.adminSession.updateMany({
        where: {
          adminUserId: request.admin.id,
          id: { not: currentSessionId },
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
    });
    response.json({
      status: 'success',
      message: 'Password changed. Other active sessions have been signed out.',
    });
  });

  router.get('/administrators', requireAdminRole('SUPER_ADMIN'), async (request, response) => {
    const admins = await request.app.locals.prisma.adminUser.findMany({
      select: MANAGED_ADMIN_SELECT,
      orderBy: [{ createdAt: 'asc' }, { username: 'asc' }],
    });
    response.json({ status: 'success', administrators: admins.map(serializeManagedAdmin) });
  });

  router.post('/administrators', requireAdminRole('SUPER_ADMIN'), async (request, response) => {
    const body = parseObject(request.body, ['username', 'newPassword', 'confirmPassword']);
    const username = requireAdminUsername(body.username);
    const { newPassword } = parsePasswordPair({
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
    });
    const passwordHash = await hashPassword(newPassword);
    const admin = await request.app.locals.prisma.adminUser.create({
      data: {
        username,
        name: username,
        email: null,
        passwordHash,
        role: 'ASSISTANT_ADMIN',
        isActive: true,
      },
      select: MANAGED_ADMIN_SELECT,
    });
    response.status(201).json({ status: 'success', administrator: serializeManagedAdmin(admin) });
  });

  router.patch('/administrators/:id/status', requireAdminRole('SUPER_ADMIN'), async (request, response) => {
    const id = parseAdminId(request.params.id);
    const body = parseObject(request.body, ['isActive']);
    if (typeof body.isActive !== 'boolean') invalid('Account status must be a boolean.');
    const prisma = request.app.locals.prisma;
    const now = new Date();
    const admin = await prisma.$transaction(async (transaction) => {
      const target = await transaction.adminUser.findUnique({
        where: { id },
        select: { id: true, role: true },
      });
      if (!target) throw accountNotFound();
      assertAssistantRole(target);
      const updated = await transaction.adminUser.update({
        where: { id },
        data: { isActive: body.isActive },
        select: MANAGED_ADMIN_SELECT,
      });
      if (!body.isActive) {
        await transaction.adminSession.updateMany({
          where: { adminUserId: id, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      return updated;
    });
    response.json({ status: 'success', administrator: serializeManagedAdmin(admin) });
  });

  router.put('/administrators/:id/password', requireAdminRole('SUPER_ADMIN'), async (request, response) => {
    const id = parseAdminId(request.params.id);
    const { newPassword } = parsePasswordPair(request.body);
    const passwordHash = await hashPassword(newPassword);
    const prisma = request.app.locals.prisma;
    const admin = await prisma.$transaction(async (transaction) => {
      const target = await transaction.adminUser.findUnique({
        where: { id },
        select: { id: true, role: true },
      });
      if (!target) throw accountNotFound();
      assertAssistantRole(target);
      const updated = await transaction.adminUser.update({
        where: { id },
        data: { passwordHash },
        select: MANAGED_ADMIN_SELECT,
      });
      await transaction.adminSession.updateMany({
        where: { adminUserId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return updated;
    });
    response.json({
      status: 'success',
      administrator: serializeManagedAdmin(admin),
      message: 'Password reset. Existing sessions have been signed out.',
    });
  });

  router.use(mapAccountErrors);
  return router;
}
