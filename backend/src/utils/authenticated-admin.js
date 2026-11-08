import { getAdminSessionToken } from './admin-session-cookie.js';
import { HttpError } from './http-error.js';
import { hashSessionToken } from './session-token.js';

function invalidSession() {
  return new HttpError(401, 'INVALID_SESSION', 'Authentication required.');
}

export async function getAuthenticatedAdmin(request) {
  const token = getAdminSessionToken(request);
  if (!token) throw invalidSession();

  const prisma = request.app.locals.prisma;
  const now = new Date();
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
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
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    !session.adminUser ||
    !session.adminUser.isActive
  ) {
    throw invalidSession();
  }

  await prisma.adminSession.update({
    where: { id: session.id },
    data: { lastSeenAt: now },
  });

  const { id, name, email, role } = session.adminUser;
  return { id, name, email, role };
}
