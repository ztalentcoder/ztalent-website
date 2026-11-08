import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, stat, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { createImageStorage } from '../src/services/image-storage.js';
import { createApp } from './helpers.js';
import { withServer } from './helpers.js';

const SESSION_COOKIE = `admin_session=${'d'.repeat(64)}`;
const resourceFolders = {
  'company-profile': 'company',
  'business-areas': 'business-areas',
  projects: 'projects',
  'blog-posts': 'blog',
  'team-members': 'team',
};

async function createImage(format) {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  }).toFormat(format).toBuffer();
}

const IMAGE_FIXTURES = await Promise.all(['jpeg', 'png', 'webp'].map(async (format) => [
  await createImage(format),
  format,
  `image/${format}`,
]));

async function createFixture(t, { role = 'EDITOR' } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ztalent-coder-images-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const imageStorage = createImageStorage({ directory });
  const references = new Set();
  const prismaClient = {
    adminSession: {
      findUnique: async () => ({
        id: 'session-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        adminUser: { id: 'admin-id', name: 'Admin', email: 'admin@example.test', role, isActive: true },
      }),
      update: async () => ({}),
    },
    companyProfile: {
      findFirst: async ({ where }) => references.has(where.logoUrl || where.homeIntroImageUrl) ? { id: 'record' } : null,
    },
    businessArea: { findFirst: async ({ where }) => references.has(where.imageUrl) ? { id: 'record' } : null },
    project: { findFirst: async ({ where }) => references.has(where.imageUrl) ? { id: 'record' } : null },
    blogPost: { findFirst: async ({ where }) => references.has(where.coverImageUrl) ? { id: 'record' } : null },
    teamMember: { findFirst: async ({ where }) => references.has(where.photoUrl) ? { id: 'record' } : null },
  };
  const app = createApp({
    prismaClient,
    imageStorage,
    frontendOrigin: 'http://frontend.test',
  });
  return { app, directory, imageStorage, references };
}

function requestHeaders(cookie = true) {
  return cookie ? { Cookie: SESSION_COOKIE } : {};
}

function multipart(buffer, fileName, mimeType) {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type: mimeType }), fileName);
  return form;
}

async function upload(baseUrl, resource, buffer, filename = 'sample.png', mime = 'image/png', cookie = true) {
  return fetch(`${baseUrl}/api/admin/images/${resource}`, {
    method: 'POST',
    headers: requestHeaders(cookie),
    body: multipart(buffer, filename, mime),
  });
}

test('image upload requires an authenticated CMS administrator', async (t) => {
  const { app } = await createFixture(t);
  await withServer(app, async (baseUrl) => {
    const response = await upload(baseUrl, 'business-areas', IMAGE_FIXTURES[1][0], 'sample.png', 'image/png', false);
    assert.equal(response.status, 401);
  });
});

test('image upload denies roles outside existing CMS content permissions', async (t) => {
  const { app } = await createFixture(t, { role: 'VIEWER' });
  await withServer(app, async (baseUrl) => {
    const response = await upload(baseUrl, 'business-areas', IMAGE_FIXTURES[1][0]);
    assert.equal(response.status, 403);
  });
});

test('SUPER_ADMIN users can upload images', async (t) => {
  const { app } = await createFixture(t, { role: 'SUPER_ADMIN' });
  await withServer(app, async (baseUrl) => {
    const response = await upload(baseUrl, 'business-areas', IMAGE_FIXTURES[1][0]);
    assert.equal(response.status, 201);
  });
});

test('JPEG, PNG, and WebP uploads are sanitized and saved in resource-specific directories', async (t) => {
  const { app, directory } = await createFixture(t);
  await withServer(app, async (baseUrl) => {
    for (const resource of Object.keys(resourceFolders)) {
      for (const [buffer, format, mime] of IMAGE_FIXTURES) {
        const response = await upload(baseUrl, resource, buffer, `untrusted-name.${format}`, mime);
        assert.equal(response.status, 201);
        const { image } = await response.json();
        const folder = resourceFolders[resource];
        const extension = format === 'jpeg' ? 'jpg' : format;
        assert.match(image.url, new RegExp(`^/uploads/images/${folder}/[0-9a-f-]{36}\\.${extension}$`));
        assert.deepEqual(Object.keys(image).sort(), ['bytes', 'format', 'url']);
        const stored = await stat(path.join(directory, folder, path.basename(image.url)));
        assert.ok(stored.isFile());
        assert.equal(image.format, format);
      }
    }
  });
});

test('unsupported formats and malformed image data are rejected', async (t) => {
  const { app, directory } = await createFixture(t);
  await withServer(app, async (baseUrl) => {
    for (const [buffer, name, mime] of [
      [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'vector.svg', 'image/svg+xml'],
      [Buffer.from('not an image'), 'fake.png', 'image/png'],
    ]) {
      const response = await upload(baseUrl, 'projects', buffer, name, mime);
      assert.equal(response.status, 400);
    }
  });
  assert.deepEqual(await readdir(directory), []);
});

test('uploads larger than 5 MB are rejected before image decoding', async (t) => {
  const { app, directory } = await createFixture(t);
  const oversized = Buffer.alloc((5 * 1024 * 1024) + 1);
  await withServer(app, async (baseUrl) => {
    const response = await upload(baseUrl, 'blog-posts', oversized, 'large.png', 'image/png');
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'IMAGE_TOO_LARGE');
  });
  assert.deepEqual(await readdir(directory), []);
});

test('uploaded images are publicly served with correct MIME and safe caching, while paths are restricted', async (t) => {
  const { app } = await createFixture(t);
  await withServer(app, async (baseUrl) => {
    const uploadResponse = await upload(baseUrl, 'team-members', IMAGE_FIXTURES[2][0], 'member.webp', 'image/webp');
    const { image } = await uploadResponse.json();
    const response = await fetch(new URL(image.url, baseUrl));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/webp/);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=86400');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), IMAGE_FIXTURES[2][0]);

    for (const unsafePath of [
      '/uploads/images/',
      '/uploads/images/../admin-images.routes.js',
      '/uploads/images/projects/not-a-generated-name.png',
      '/uploads/images/projects/123e4567-e89b-42d3-a456-426614174000.svg',
    ]) {
      const rejected = await fetch(new URL(unsafePath, baseUrl));
      assert.equal(rejected.status, 404);
    }
  });
});

test('managed image deletion preserves shared references and safely removes replaced images', async (t) => {
  const { app, directory, references } = await createFixture(t);
  await withServer(app, async (baseUrl) => {
    const firstUpload = await upload(baseUrl, 'business-areas', IMAGE_FIXTURES[1][0]);
    const firstImage = (await firstUpload.json()).image;
    references.add(firstImage.url);

    const replacementUpload = await upload(baseUrl, 'business-areas', IMAGE_FIXTURES[2][0], 'replacement.webp', 'image/webp');
    const replacement = (await replacementUpload.json()).image;
    const sharedDelete = await fetch(`${baseUrl}/api/admin/images`, {
      method: 'DELETE',
      headers: { ...requestHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: firstImage.url }),
    });
    assert.deepEqual(await sharedDelete.json(), { status: 'success', managed: true, deleted: false });
    assert.ok((await stat(path.join(directory, 'business-areas', path.basename(firstImage.url)))).isFile());

    references.delete(firstImage.url);
    references.add(replacement.url);
    const replacedDelete = await fetch(`${baseUrl}/api/admin/images`, {
      method: 'DELETE',
      headers: { ...requestHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: firstImage.url }),
    });
    assert.deepEqual(await replacedDelete.json(), { status: 'success', managed: true, deleted: true });
    await assert.rejects(stat(path.join(directory, 'business-areas', path.basename(firstImage.url))), { code: 'ENOENT' });
    assert.ok((await stat(path.join(directory, 'business-areas', path.basename(replacement.url)))).isFile());
  });
});

test('external URLs are preserved and missing managed files can be deleted idempotently', async (t) => {
  const { app, directory } = await createFixture(t);
  await withServer(app, async (baseUrl) => {
    const external = await fetch(`${baseUrl}/api/admin/images`, {
      method: 'DELETE',
      headers: { ...requestHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://legacy.example.test/image.jpg' }),
    });
    assert.deepEqual(await external.json(), { status: 'success', managed: false, deleted: false });

    const uploadResponse = await upload(baseUrl, 'company-profile', IMAGE_FIXTURES[0][0], 'logo.jpg', 'image/jpeg');
    const { image } = await uploadResponse.json();
    await unlink(path.join(directory, 'company', path.basename(image.url)));
    const missing = await fetch(`${baseUrl}/api/admin/images`, {
      method: 'DELETE',
      headers: { ...requestHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: image.url }),
    });
    assert.deepEqual(await missing.json(), { status: 'success', managed: true, deleted: true });
  });
});
