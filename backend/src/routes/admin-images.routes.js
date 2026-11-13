import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import { requireAdminAuth } from '../middleware/require-admin-auth.js';
import { requireAdminRole } from '../middleware/require-admin-role.js';
import { errorHandler } from '../middleware/error-handler.js';
import { createImageStorage } from '../services/image-storage.js';
import { HttpError } from '../utils/http-error.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const CONTENT_ROLES = ['SUPER_ADMIN', 'EDITOR'];
const IMAGE_RESOURCES = new Set([
  'company-profile',
  'business-areas',
  'projects',
  'blog-posts',
  'team-members',
  'academic-courses',
  'course-categories',
]);
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0 },
});

function parseMultipartImage(request, _response, next) {
  imageUpload.single('image')(request, _response, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'IMAGE_TOO_LARGE', 'Images must be 5 MB or smaller.'));
    }
    return next(new HttpError(400, 'INVALID_IMAGE_UPLOAD', 'Choose one image file to upload.'));
  });
}

async function decodeAndSanitizeImage(buffer) {
  try {
    const metadata = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw new HttpError(400, 'UNSUPPORTED_IMAGE_FORMAT', 'Only JPEG, PNG, and WebP images are supported.');
    }

    const sanitized = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .toFormat(metadata.format, metadata.format === 'jpeg' ? { quality: 88 } : undefined)
      .toBuffer();

    if (sanitized.length > MAX_FILE_SIZE) {
      throw new HttpError(413, 'IMAGE_TOO_LARGE', 'The processed image exceeds the 5 MB limit.');
    }
    return { buffer: sanitized, format: metadata.format };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'INVALID_IMAGE_CONTENT', 'The selected file is not a valid supported image.');
  }
}

async function isImageReferenced(prisma, url) {
  const references = await Promise.all([
    prisma.companyProfile.findFirst({ where: { logoUrl: url }, select: { id: true } }),
    prisma.companyProfile.findFirst({ where: { homeIntroImageUrl: url }, select: { id: true } }),
    prisma.businessArea.findFirst({ where: { imageUrl: url }, select: { id: true } }),
    prisma.project.findFirst({ where: { imageUrl: url }, select: { id: true } }),
    prisma.project.findFirst({ where: { galleryImages: { some: { imageUrl: url } } }, select: { id: true } }),
    prisma.blogPost.findFirst({
      where: { OR: [{ coverImageUrl: url }, { body: { contains: url } }] },
      select: { id: true },
    }),
    prisma.teamMember.findFirst({ where: { photoUrl: url }, select: { id: true } }),
    prisma.academicCourse.findFirst({ where: { imageUrl: url }, select: { id: true } }),
    prisma.courseCategory.findFirst({ where: { imageUrl: url }, select: { id: true } }),
  ]);
  return references.some(Boolean);
}

export function createAdminImagesRouter({
  imageStorage = createImageStorage(),
  uploadRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  }),
} = {}) {
  const router = Router();
  router.use(requireAdminAuth, requireAdminRole(...CONTENT_ROLES));

  router.post('/:resource', uploadRateLimit, (request, _response, next) => {
    if (!IMAGE_RESOURCES.has(request.params.resource)) {
      next(new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.'));
      return;
    }
    next();
  }, parseMultipartImage, async (request, response) => {
    if (!request.file) {
      throw new HttpError(400, 'IMAGE_REQUIRED', 'Choose an image file to upload.');
    }

    const { buffer, format } = await decodeAndSanitizeImage(request.file.buffer);
    try {
      const image = await imageStorage.uploadImage({
        buffer,
        format,
        resource: request.params.resource,
      });
      response.status(201).json({ status: 'success', image });
    } catch (error) {
      if (error.code === 'IMAGE_STORAGE_FAILED') {
        console.error(JSON.stringify({
          level: 'error',
          event: 'managed_image_upload_failed',
          method: request.method,
          path: request.path,
        }));
        throw new HttpError(500, 'IMAGE_STORAGE_FAILED', error.message);
      }
      throw error;
    }
  });

  router.delete('/', async (request, response) => {
    const url = request.body?.url;
    if (typeof url !== 'string' || url.length > 2048) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'A valid image URL is required.');
    }
    if (!imageStorage.isManagedUrl(url)) {
      response.json({ status: 'success', managed: false, deleted: false });
      return;
    }
    if (await isImageReferenced(request.app.locals.prisma, url)) {
      response.json({ status: 'success', managed: true, deleted: false });
      return;
    }

    try {
      const result = await imageStorage.deleteImage(url);
      response.json({ status: 'success', ...result });
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'managed_image_cleanup_failed',
        method: request.method,
        path: request.path,
        code: error.code || 'IMAGE_STORAGE_FAILED',
      }));
      if (error.code === 'IMAGE_STORAGE_FAILED') {
        throw new HttpError(500, 'IMAGE_STORAGE_FAILED', error.message);
      }
      throw error;
    }
  });

  router.use(errorHandler);
  return router;
}

export function createPublicImagesRouter({ imageStorage = createImageStorage() } = {}) {
  const router = Router();
  router.use((request, _response, next) => {
    if (!/^\/(?:company|business-areas|projects|blog|team|courses|course-categories)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/.test(request.path)) {
      next(new HttpError(404, 'NOT_FOUND', 'The requested image was not found.'));
      return;
    }
    next();
  });
  router.use(express.static(imageStorage.getPublicDirectory(), {
    dotfiles: 'deny',
    index: false,
    redirect: false,
    fallthrough: true,
    maxAge: '1d',
    setHeaders(response) {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Cache-Control', 'public, max-age=86400');
    },
  }));
  router.use((_request, _response, next) => next(new HttpError(404, 'NOT_FOUND', 'The requested image was not found.')));
  router.use(errorHandler);
  return router;
}
