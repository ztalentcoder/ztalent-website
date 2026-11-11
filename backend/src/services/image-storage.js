import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_IMAGE_DIRECTORY = fileURLToPath(new URL('../../uploads/images/', import.meta.url));
const resourceFolders = Object.freeze({
  'company-profile': 'company',
  'business-areas': 'business-areas',
  projects: 'projects',
  'blog-posts': 'blog',
  'team-members': 'team',
  'academic-courses': 'courses',
  'course-categories': 'course-categories',
});
const formatExtensions = Object.freeze({ jpeg: 'jpg', png: 'png', webp: 'webp' });
const filenamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

function parseManagedUrl(url) {
  if (typeof url !== 'string') return null;
  const match = /^\/uploads\/images\/(company|business-areas|projects|blog|team|courses|course-categories)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp))$/.exec(url);
  return match ? { folder: match[1], filename: match[2] } : null;
}

function storageError(cause) {
  const error = new Error('The image could not be saved in managed storage.', { cause });
  error.code = 'IMAGE_STORAGE_FAILED';
  return error;
}

export function createImageStorage({ directory = DEFAULT_IMAGE_DIRECTORY } = {}) {
  const imageDirectory = path.resolve(directory);

  function getImagePath(folder, filename) {
    if (!Object.values(resourceFolders).includes(folder) || !filenamePattern.test(filename)) {
      return null;
    }
    return path.join(imageDirectory, folder, filename);
  }

  return {
    getPublicDirectory() {
      return imageDirectory;
    },

    async uploadImage({ buffer, resource, format }) {
      const folder = resourceFolders[resource];
      const extension = formatExtensions[format];
      if (!folder || !extension) throw new TypeError('Unsupported image resource or format.');

      const filename = `${randomUUID()}.${extension}`;
      const destination = getImagePath(folder, filename);
      try {
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, buffer, { flag: 'wx', mode: 0o644 });
      } catch (error) {
        throw storageError(error);
      }

      return {
        url: `/uploads/images/${folder}/${filename}`,
        format,
        bytes: buffer.length,
      };
    },

    isManagedUrl(url) {
      return Boolean(parseManagedUrl(url));
    },

    async deleteImage(url) {
      const asset = parseManagedUrl(url);
      if (!asset) return { managed: false, deleted: false };

      const filePath = getImagePath(asset.folder, asset.filename);
      try {
        await unlink(filePath);
      } catch (error) {
        if (error.code === 'ENOENT') return { managed: true, deleted: true };
        throw storageError(error);
      }

      return { managed: true, deleted: true };
    },
  };
}

export { DEFAULT_IMAGE_DIRECTORY };
