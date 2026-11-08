import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createContactMessage } from '../controllers/contact.controller.js';

export function createContactRouter({
  limit = 5,
  windowMs = 15 * 60 * 1000,
} = {}) {
  const contactRouter = Router();
  const submissionLimiter = rateLimit({
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
          message: 'Too many contact submissions. Please try again later.',
        },
      });
    },
  });

  contactRouter.post('/', submissionLimiter, createContactMessage);
  return contactRouter;
}
