import { PrismaClient } from '@prisma/client';
import './environment.js';

const prismaGlobal = globalThis;

export const prisma = prismaGlobal.__ztalentPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.__ztalentPrisma = prisma;
}
