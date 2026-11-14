import {
  clearAdminSessionCookie,
  getAdminSessionCookieValue,
  setAdminSessionCookie,
} from '../utils/admin-session-cookie.js';
import { getAuthenticatedAdmin } from '../utils/authenticated-admin.js';
import { HttpError } from '../utils/http-error.js';
import { verifyPassword } from '../utils/password.js';
import { generateSessionToken, hashSessionToken } from '../utils/session-token.js';
import { validateAdminLogin } from '../validators/admin-login.js';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function invalidCredentials() {
  return new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email, username, or password.');
}

function safeAdminDetails(admin) {
  return {
    id: admin.id,
    username: admin.username,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };
}

export async function loginAdmin(request, response) {
  const { identifier, identifierType, password } = validateAdminLogin(request.body);
  const prisma = request.app.locals.prisma;
  const admin = await prisma.adminUser.findUnique({
    where: { [identifierType]: identifier },
  });

  if (
    !admin ||
    !await verifyPassword(password, admin.passwordHash) ||
    !admin.isActive
  ) {
    throw invalidCredentials();
  }

  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  const userAgent = request.get('user-agent')?.slice(0, 512) ?? null;

  await prisma.$transaction(async (transaction) => {
    await transaction.adminSession.create({
      data: {
        adminUserId: admin.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
        lastSeenAt: now,
        userAgent,
      },
    });
    await transaction.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: now },
    });
  });

  setAdminSessionCookie(response, token);
  response.status(200).json({
    status: 'success',
    admin: safeAdminDetails(admin),
  });
}

export async function getCurrentAdmin(request, response) {
  const admin = await getAuthenticatedAdmin(request);
  response.status(200).json({
    status: 'success',
    admin,
  });
}

export async function logoutAdmin(request, response) {
  const token = getAdminSessionCookieValue(request);

  if (token) {
    const tokenHash = hashSessionToken(token);
    const prisma = request.app.locals.prisma;
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        revokedAt: true,
      },
    });

    if (session && session.revokedAt === null) {
      await prisma.adminSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }
  }

  clearAdminSessionCookie(response);
  response.status(200).json({
    status: 'success',
    message: 'Logged out successfully.',
  });
}
