import argon2 from 'argon2';

const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password) {
  return argon2.hash(password, PASSWORD_HASH_OPTIONS);
}

export async function verifyPassword(password, passwordHash) {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}
