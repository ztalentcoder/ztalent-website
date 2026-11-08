import express from 'express';
import { prisma } from './config/database.js';
import { config } from './config/environment.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { securityHeaders } from './middleware/security-headers.js';
import { createAdminAuthRouter } from './routes/admin-auth.routes.js';
import { createAdminCmsRouter } from './routes/admin-cms.routes.js';
import { createAdminImagesRouter, createPublicImagesRouter } from './routes/admin-images.routes.js';
import { createContactRouter } from './routes/contact.routes.js';
import { createPublicContentRouter } from './routes/public-content.routes.js';
import { createImageStorage } from './services/image-storage.js';
import healthRouter from './routes/health.routes.js';

export function createApp({
  prismaClient = prisma,
  frontendOrigin = config.frontendOrigin,
  contactRateLimit,
  adminLoginRateLimit,
  imageStorage,
  imageRateLimit,
} = {}) {
  const app = express();
  const actualImageStorage = imageStorage ?? createImageStorage();

  app.disable('x-powered-by');
  app.locals.prisma = prismaClient;
  app.use(securityHeaders);
  app.use(createCorsMiddleware(frontendOrigin));
  app.use(express.json({ limit: '100kb' }));
  app.use('/uploads/images', createPublicImagesRouter({ imageStorage: actualImageStorage }));
  app.use('/api/health', healthRouter);
  app.use('/api/public', createPublicContentRouter());
  app.use('/api/admin/auth', createAdminAuthRouter(adminLoginRateLimit));
  app.use('/api/admin/images', createAdminImagesRouter({
    imageStorage: actualImageStorage,
    ...(imageRateLimit ? { uploadRateLimit: imageRateLimit } : {}),
  }));
  app.use('/api/admin', createAdminCmsRouter());
  app.use('/api/contact', createContactRouter(contactRateLimit));
  app.use('/api', notFound);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
