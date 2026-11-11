import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from './helpers.js';
import { withServer } from './helpers.js';

const COURSE_ID = '123e4567-e89b-42d3-a456-426614174000';
const CATEGORY_ID = '123e4567-e89b-42d3-a456-426614174001';
const EPISODE_A = '123e4567-e89b-42d3-a456-426614174002';
const EPISODE_B = '123e4567-e89b-42d3-a456-426614174003';
const SESSION_COOKIE = `admin_session=${'d'.repeat(64)}`;

function createPrisma({ role = 'EDITOR', overrides = {} } = {}) {
  const prisma = {
    adminSession: {
      findUnique: async () => ({
        id: 'session-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        adminUser: { id: 'admin-id', name: 'Admin', email: 'admin@example.test', role, isActive: true },
      }),
      update: async () => ({}),
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  for (const model of [
    'companyProfile', 'aboutPageContent', 'socialLink', 'businessArea', 'service', 'project',
    'academicCourse', 'courseCategory', 'courseEpisode', 'blogCategory', 'blogPost',
    'teamMember', 'testimonial', 'siteStatistic', 'contactMessage',
  ]) {
    prisma[model] = {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 'created-id', ...data }),
      update: async ({ data }) => ({ id: 'existing-id', ...data }),
      updateMany: async () => ({ count: 0 }),
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
      upsert: async ({ create }) => ({ ...create }),
    };
  }
  return Object.assign(prisma, overrides);
}

function createAdminApp(prisma) {
  return createApp({ prismaClient: prisma, frontendOrigin: 'http://frontend.test' });
}

function headers() {
  return { Cookie: SESSION_COOKIE, 'Content-Type': 'application/json' };
}

test('course categories can be edited and cannot be deleted while courses reference them', async () => {
  const calls = [];
  const prisma = createPrisma({
    overrides: {
      courseCategory: {
        create: async ({ data }) => ({ id: CATEGORY_ID, ...data }),
        update: async ({ where, data }) => {
          calls.push({ where, data });
          return { id: where.id, ...data };
        },
        delete: async () => { throw new Error('in-use category must not be deleted'); },
      },
      academicCourse: { count: async ({ where }) => (where.courseCategoryId === CATEGORY_ID ? 1 : 0) },
    },
  });
  await withServer(createAdminApp(prisma), async (baseUrl) => {
    const created = await fetch(`${baseUrl}/api/admin/course-categories`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name: 'Web Development',
        slug: 'web-development',
        description: 'Build modern websites.',
        status: 'PUBLISHED',
        sortOrder: 0,
      }),
    });
    assert.equal(created.status, 201);

    const updated = await fetch(`${baseUrl}/api/admin/course-categories/${CATEGORY_ID}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ name: 'Web Engineering', status: 'PUBLISHED', sortOrder: 2 }),
    });
    assert.equal(updated.status, 200);
    assert.deepEqual((await updated.json()).item, {
      id: CATEGORY_ID,
      name: 'Web Engineering',
      status: 'PUBLISHED',
      sortOrder: 2,
    });

    const deleted = await fetch(`${baseUrl}/api/admin/course-categories/${CATEGORY_ID}`, {
      method: 'DELETE',
      headers: headers(),
    });
    assert.equal(deleted.status, 409);
    assert.equal((await deleted.json()).error.code, 'CATEGORY_IN_USE');
  });
  assert.deepEqual(calls, [{
    where: { id: CATEGORY_ID },
    data: { name: 'Web Engineering', status: 'PUBLISHED', sortOrder: 2 },
  }]);
});

test('courses require an existing category and reject non-YouTube links', async () => {
  const created = [];
  const prisma = createPrisma({
    overrides: {
      courseCategory: {
        findUnique: async ({ where }) => where.id === CATEGORY_ID ? { id: CATEGORY_ID, status: 'PUBLISHED' } : null,
      },
      academicCourse: {
        findUnique: async () => null,
        create: async ({ data }) => {
          created.push(data);
          return { id: COURSE_ID, ...data };
        },
      },
    },
  });
  await withServer(createAdminApp(prisma), async (baseUrl) => {
    const course = {
      title: 'Modern Web Development',
      slug: 'modern-web-development',
      description: 'Build practical web applications.',
      level: 'BEGINNER',
      courseCategoryId: CATEGORY_ID,
      status: 'PUBLISHED',
      externalUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    };
    const response = await fetch(`${baseUrl}/api/admin/academic-courses`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(course),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).item.externalUrl, course.externalUrl);

    const invalidUrl = await fetch(`${baseUrl}/api/admin/academic-courses`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ...course, slug: 'other-course', externalUrl: 'https://example.test/course' }),
    });
    assert.equal(invalidUrl.status, 400);
  });
  assert.equal(created.length, 1);
  assert.deepEqual(created[0].learningOutcomes, undefined);
});

test('duplicate course titles receive unique generated slugs, including concurrent creates', async () => {
  const savedCourses = new Map();
  let nextId = 0;
  const prisma = createPrisma({
    overrides: {
      courseCategory: {
        findUnique: async ({ where }) => where.id === CATEGORY_ID ? { id: CATEGORY_ID, status: 'PUBLISHED' } : null,
      },
      academicCourse: {
        findUnique: async ({ where }) => where.slug
          ? savedCourses.get(where.slug) ?? null
          : null,
        create: async ({ data }) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          if (savedCourses.has(data.slug)) {
            const error = new Error('Unique slug violation');
            error.code = 'P2002';
            throw error;
          }
          const item = { id: `course-${++nextId}`, ...data };
          savedCourses.set(data.slug, item);
          return item;
        },
      },
    },
  });
  await withServer(createAdminApp(prisma), async (baseUrl) => {
    const body = {
      title: 'Web Development with AI',
      description: 'Build practical AI-powered applications.',
      level: 'BEGINNER',
      courseCategoryId: CATEGORY_ID,
      status: 'DRAFT',
    };
    const createCourse = () => fetch(`${baseUrl}/api/admin/academic-courses`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    const firstPair = await Promise.all([createCourse(), createCourse()]);
    assert.deepEqual(firstPair.map((response) => response.status), [201, 201]);
    const created = await Promise.all(firstPair.map(async (response) => (await response.json()).item));
    assert.deepEqual(created.map((course) => course.slug).sort(), [
      'web-development-with-ai',
      'web-development-with-ai-2',
    ]);

    const third = await createCourse();
    assert.equal(third.status, 201);
    assert.equal((await third.json()).item.slug, 'web-development-with-ai-3');
  });
});

test('editing a generated course slug follows title changes while custom slugs remain unchanged', async () => {
  const current = new Map([
    [COURSE_ID, {
      id: COURSE_ID,
      title: 'Web Development with AI',
      slug: 'web-development-with-ai',
      courseCategoryId: CATEGORY_ID,
      status: 'DRAFT',
    }],
    [EPISODE_A, {
      id: EPISODE_A,
      title: 'Custom Course Name',
      slug: 'custom-public-url',
      courseCategoryId: CATEGORY_ID,
      status: 'DRAFT',
    }],
  ]);
  const slugs = new Map([
    ['web-development-with-ai', current.get(COURSE_ID)],
    ['custom-public-url', current.get(EPISODE_A)],
  ]);
  const prisma = createPrisma({
    overrides: {
      courseCategory: {
        findUnique: async ({ where }) => where.id === CATEGORY_ID ? { id: CATEGORY_ID, status: 'PUBLISHED' } : null,
      },
      academicCourse: {
        findUnique: async ({ where }) => where.id
          ? current.get(where.id) ?? null
          : slugs.get(where.slug) ?? null,
        update: async ({ where, data }) => {
          const previous = current.get(where.id);
          if (previous.slug !== data.slug) slugs.delete(previous.slug);
          const updated = { ...previous, ...data };
          current.set(where.id, updated);
          if (data.slug) slugs.set(data.slug, updated);
          return updated;
        },
      },
    },
  });
  await withServer(createAdminApp(prisma), async (baseUrl) => {
    const generated = await fetch(`${baseUrl}/api/admin/academic-courses/${COURSE_ID}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ title: 'Advanced Web Development with AI' }),
    });
    assert.equal(generated.status, 200);
    assert.equal((await generated.json()).item.slug, 'advanced-web-development-with-ai');

    const customized = await fetch(`${baseUrl}/api/admin/academic-courses/${EPISODE_A}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ title: 'Renamed Course' }),
    });
    assert.equal(customized.status, 200);
    assert.equal((await customized.json()).item.slug, 'custom-public-url');
  });
});

test('episode management validates YouTube URLs and atomically orders every episode', async () => {
  const updated = [];
  const prisma = createPrisma({
    overrides: {
      academicCourse: {
        findUnique: async ({ where }) => where.id === COURSE_ID ? { id: COURSE_ID } : null,
      },
      courseEpisode: {
        findMany: async ({ select }) => select ? [{ id: EPISODE_A }, { id: EPISODE_B }] : [],
        create: async ({ data }) => ({ id: EPISODE_A, ...data }),
        update: async ({ where, data }) => {
          updated.push({ where, data });
          return { id: where.id, ...data };
        },
      },
    },
  });
  await withServer(createAdminApp(prisma), async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/api/admin/academic-courses/${COURSE_ID}/episodes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        title: 'Episode 1',
        youtubeUrl: 'https://example.test/video',
        status: 'PUBLISHED',
      }),
    });
    assert.equal(invalid.status, 400);

    const created = await fetch(`${baseUrl}/api/admin/academic-courses/${COURSE_ID}/episodes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        title: 'Episode 1',
        youtubeUrl: 'https://youtu.be/abcdefghijk',
        status: 'PUBLISHED',
      }),
    });
    assert.equal(created.status, 201);

    const reordered = await fetch(`${baseUrl}/api/admin/academic-courses/${COURSE_ID}/episodes/reorder`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ episodeIds: [EPISODE_B, EPISODE_A] }),
    });
    assert.equal(reordered.status, 200);

    const incompleteOrder = await fetch(`${baseUrl}/api/admin/academic-courses/${COURSE_ID}/episodes/reorder`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ episodeIds: [EPISODE_A] }),
    });
    assert.equal(incompleteOrder.status, 400);
  });
  assert.deepEqual(updated, [
    { where: { id: EPISODE_B }, data: { sortOrder: 0 } },
    { where: { id: EPISODE_A }, data: { sortOrder: 1 } },
  ]);
});

test('course and episode updates preserve category and course ownership checks', async () => {
  const updatedEpisodes = [];
  let deletedEpisode = null;
  const prisma = createPrisma({
    overrides: {
      courseCategory: {
        findUnique: async ({ where }) => where.id === CATEGORY_ID ? { id: CATEGORY_ID, status: 'PUBLISHED' } : null,
      },
      academicCourse: {
        findUnique: async ({ where }) => where.id === COURSE_ID
          ? {
            id: COURSE_ID,
            title: 'Current course',
            slug: 'current-course',
            courseCategoryId: CATEGORY_ID,
            status: 'DRAFT',
          }
          : null,
        update: async ({ where, data }) => ({ id: where.id, ...data }),
      },
      courseEpisode: {
        findFirst: async ({ where }) => (
          where.courseId === COURSE_ID && where.id === EPISODE_A ? { id: EPISODE_A } : null
        ),
        update: async ({ where, data }) => {
          updatedEpisodes.push({ where, data });
          return { id: where.id, ...data };
        },
        delete: async ({ where }) => { deletedEpisode = where.id; },
      },
    },
  });
  await withServer(createAdminApp(prisma), async (baseUrl) => {
    const course = await fetch(`${baseUrl}/api/admin/academic-courses/${COURSE_ID}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status: 'PUBLISHED', courseCategoryId: CATEGORY_ID }),
    });
    assert.equal(course.status, 200);

    const episode = await fetch(`${baseUrl}/api/admin/academic-courses/${COURSE_ID}/episodes/${EPISODE_A}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({
        title: 'Updated lesson',
        youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
        status: 'PUBLISHED',
      }),
    });
    assert.equal(episode.status, 200);

    const deleted = await fetch(`${baseUrl}/api/admin/academic-courses/${COURSE_ID}/episodes/${EPISODE_A}`, {
      method: 'DELETE',
      headers: headers(),
    });
    assert.equal(deleted.status, 200);

    const wrongCourse = await fetch(`${baseUrl}/api/admin/academic-courses/${COURSE_ID}/episodes/${EPISODE_B}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({
        title: 'Other course lesson',
        youtubeUrl: 'https://youtu.be/abcdefghijk',
        status: 'PUBLISHED',
      }),
    });
    assert.equal(wrongCourse.status, 404);
  });
  assert.deepEqual(updatedEpisodes, [{
    where: { id: EPISODE_A },
    data: {
      title: 'Updated lesson',
      youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      status: 'PUBLISHED',
    },
  }]);
  assert.equal(deletedEpisode, EPISODE_A);
});
