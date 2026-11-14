import { validateAdminLogin } from '../validators/admin-login.js';
import { usernameFromEmail, requireAdminUsername } from '../validators/admin-username.js';
import { hashPassword } from '../utils/password.js';

export class InitialAdminProvisioningError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'InitialAdminProvisioningError';
    this.code = code;
  }
}

export async function provisionInitialAdmin(prisma, input) {
  if (!input || typeof input.name !== 'string') {
    throw new InitialAdminProvisioningError('INVALID_INPUT', 'A valid name, email, and password are required.');
  }

  const name = input.name.trim();
  if (!name || name.length > 160 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new InitialAdminProvisioningError('INVALID_INPUT', 'A valid name, email, and password are required.');
  }

  if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 1024) {
    throw new InitialAdminProvisioningError('INVALID_INPUT', 'Password must be between 12 and 1024 characters.');
  }

  let credentials;
  try {
    credentials = validateAdminLogin({ email: input.email, password: input.password });
    if (credentials.identifierType !== 'email') throw new Error('Invalid email.');
  } catch {
    throw new InitialAdminProvisioningError('INVALID_INPUT', 'A valid name, email, and password are required.');
  }
  let username;
  try {
    username = requireAdminUsername(input.username ?? usernameFromEmail(credentials.identifier));
  } catch {
    throw new InitialAdminProvisioningError('INVALID_INPUT', 'A valid username, name, email, and password are required.');
  }

  return prisma.$transaction(async (transaction) => {
    const adminCount = await transaction.adminUser.count();
    if (adminCount > 0) {
      throw new InitialAdminProvisioningError(
        'ADMIN_ALREADY_EXISTS',
        'An admin account already exists; initial provisioning is disabled.',
      );
    }

    const passwordHash = await hashPassword(credentials.password);
    return transaction.adminUser.create({
      data: {
        name,
        username,
        email: credentials.identifier,
        passwordHash,
        role: 'SUPER_ADMIN',
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }, { isolationLevel: 'Serializable' });
}
