import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  getCurrentAdmin,
  loginAdmin,
  logoutAdmin,
} from '../controllers/admin-auth.controller.js';

export function createAdminAuthRouter({
  limit = 5,
  windowMs = 15 * 60 * 1000,
} = {}) {
  const adminAuthRouter = Router();
  const loginLimiter = rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
    },
    handler: (_request, response) => {
      response.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many login attempts. Please try again later.',
        },
      });
    },
  });

  adminAuthRouter.post('/login', loginLimiter, loginAdmin);
  adminAuthRouter.get('/me', getCurrentAdmin);
  adminAuthRouter.post('/logout', logoutAdmin);
  return adminAuthRouter;
}
