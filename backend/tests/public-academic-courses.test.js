import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from './helpers.js';
import { withServer } from './helpers.js';

function publicPrisma(overrides = {}) {
  const names = [
    'companyProfile', 'aboutPageContent', 'businessArea', 'service', 'project', 'academicCourse',
    'courseCategory', 'courseEpisode', 'blogCategory', 'blogPost', 'teamMember', 'testimonial',
    'siteStatistic',
  ];
  const prisma = Object.fromEntries(names.map((name) => [name, {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    count: async () => 0,
  }]));
  return Object.assign(prisma, overrides);
}

function publicApp(prisma) {
  return createApp({ prismaClient: prisma, frontendOrigin: 'http://frontend.test' });
}

test('public course catalogue combines filters and derives the count from published episodes', async () => {
  const queries = {};
  const prisma = publicPrisma({
    academicCourse: {
      findMany: async (options) => {
        queries.list = options;
        return [{
          slug: 'python-for-data',
          title: 'Python for Data',
          summary: 'Learn Python.',
          description: 'Full course description.',
          imageUrl: null,
          level: 'BEGINNER',
          language: null,
          learningOutcomes: ['Analyze datasets'],
          requirements: [],
          externalUrl: 'https://youtu.be/abcdefghijk',
          publishedAt: null,
          category: { slug: 'data-science', name: 'Data Science' },
          episodes: [{ id: 'one' }, { id: 'two' }],
        }];
      },
      count: async ({ where }) => { queries.count = where; return 1; },
    },
  });
  await withServer(publicApp(prisma), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/public/academic-courses?search=python&category=data-science&level=BEGINNER&sort=titleAsc`,
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.items[0].episodeCount, 2);
    assert.deepEqual(payload.items[0].category, { slug: 'data-science', name: 'Data Science' });
    assert.equal(payload.items[0].externalUrl, 'https://youtu.be/abcdefghijk');
    assert.deepEqual(payload.pagination, { page: 1, pageSize: 12, total: 1, pageCount: 1 });
  });
  const expectedWhere = {
    status: 'PUBLISHED',
    category: { status: 'PUBLISHED', slug: 'data-science' },
    level: 'BEGINNER',
    title: { contains: 'python', mode: 'insensitive' },
  };
  assert.deepEqual(queries.list.where, expectedWhere);
  assert.deepEqual(queries.count, expectedWhere);
  assert.deepEqual(queries.list.orderBy, [{ title: 'asc' }]);
  assert.deepEqual(queries.list.select.episodes.where, { status: 'PUBLISHED' });
});

test('public category list and course details include published content only', async () => {
  const queries = {};
  const prisma = publicPrisma({
    courseCategory: {
      findMany: async (options) => { queries.categories = options; return []; },
      count: async ({ where }) => { queries.categoryCount = where; return 0; },
    },
    academicCourse: {
      findFirst: async (options) => {
        queries.details ??= [];
        queries.details.push(options);
        if (options.where.slug !== 'public-course') return null;
        return {
          slug: 'public-course',
          title: 'Public course',
          summary: null,
          description: 'Details',
          imageUrl: null,
          level: 'ADVANCED',
          language: null,
          learningOutcomes: [],
          requirements: [],
          externalUrl: null,
          publishedAt: null,
          category: { slug: 'web-development', name: 'Web Development' },
          episodes: [
            { title: 'First', summary: null, youtubeUrl: 'https://youtu.be/abcdefghijk' },
            { title: 'Second', summary: 'More', youtubeUrl: 'https://youtu.be/lmnopqrstuv' },
          ],
        };
      },
    },
  });
  await withServer(publicApp(prisma), async (baseUrl) => {
    const categories = await fetch(`${baseUrl}/api/public/course-categories`);
    assert.equal(categories.status, 200);
    const detail = await fetch(`${baseUrl}/api/public/academic-courses/public-course`);
    assert.equal(detail.status, 200);
    assert.deepEqual((await detail.json()).item.episodes.map(({ number }) => number), [1, 2]);

    const missing = await fetch(`${baseUrl}/api/public/academic-courses/not-published`);
    assert.equal(missing.status, 404);
    const malformed = await fetch(`${baseUrl}/api/public/academic-courses/Not%20a%20slug`);
    assert.equal(malformed.status, 404);
  });
  assert.deepEqual(queries.categories.where, { status: 'PUBLISHED' });
  assert.deepEqual(queries.categoryCount, { status: 'PUBLISHED' });
  assert.deepEqual(queries.details[0].where, {
    slug: 'public-course',
    status: 'PUBLISHED',
    category: { status: 'PUBLISHED' },
  });
  assert.deepEqual(queries.details[0].select.episodes.where, { status: 'PUBLISHED' });
});
