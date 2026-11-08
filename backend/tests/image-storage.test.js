import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createImageStorage } from '../src/services/image-storage.js';

test('local storage creates resource folders and safe unique public names', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ztalent-storage-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = createImageStorage({ directory });

  const first = await storage.uploadImage({ buffer: Buffer.from('safe-image'), resource: 'business-areas', format: 'png' });
  const second = await storage.uploadImage({ buffer: Buffer.from('safe-image'), resource: 'business-areas', format: 'png' });

  assert.match(first.url, /^\/uploads\/images\/business-areas\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/);
  assert.notEqual(first.url, second.url);
  assert.equal(first.bytes, 10);
  assert.equal(storage.getPublicDirectory(), path.resolve(directory));
  assert.equal((await stat(path.join(directory, 'business-areas', path.basename(first.url)))).isFile(), true);
});

test('local image URLs are managed only for exact supported generated paths', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ztalent-storage-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = createImageStorage({ directory });
  const managedUrl = '/uploads/images/blog/123e4567-e89b-42d3-a456-426614174000.webp';

  assert.equal(storage.isManagedUrl(managedUrl), true);
  for (const url of [
    'https://legacy.example.test/image.jpg',
    '/uploads/images/../outside.png',
    '/uploads/images/projects/not-a-uuid.png',
    '/uploads/images/projects/123e4567-e89b-42d3-a456-426614174000.svg',
    '/uploads/images/team/123e4567-e89b-42d3-a456-426614174000.webp?download=1',
  ]) {
    assert.equal(storage.isManagedUrl(url), false);
    assert.deepEqual(await storage.deleteImage(url), { managed: false, deleted: false });
  }
});

test('deletion removes only matching uploads and handles already-missing files', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ztalent-storage-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = createImageStorage({ directory });
  const url = '/uploads/images/team/123e4567-e89b-42d3-a456-426614174000.jpg';
  const teamDirectory = path.join(directory, 'team');
  await mkdir(teamDirectory, { recursive: true });
  const file = path.join(teamDirectory, path.basename(url));
  await writeFile(file, 'image', { flag: 'wx' });

  assert.deepEqual(await storage.deleteImage(url), { managed: true, deleted: true });
  await assert.rejects(stat(file), { code: 'ENOENT' });
  assert.deepEqual(await storage.deleteImage(url), { managed: true, deleted: true });
});
