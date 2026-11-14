import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from './helpers.js';
import { withServer } from './helpers.js';
import { DEFAULT_ABOUT_PAGE_CONTENT } from '../src/services/about-page-content.js';

function createPublicPrisma(overrides = {}) {
  const names = [
    'companyProfile',
    'aboutPageContent',
    'businessArea',
    'service',
    'project',
    'academicCourse',
    'courseCategory',
    'blogCategory',
    'blogPost',
    'teamMember',
    'testimonial',
    'siteStatistic',
  ];
  const prisma = {};
  for (const name of names) {
    prisma[name] = {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      count: async () => 0,
    };
  }
  Object.assign(prisma, overrides);
  return prisma;
}

function publicApp(prisma = createPublicPrisma()) {
  return createApp({ prismaClient: prisma, frontendOrigin: 'http://frontend.test' });
}

test('public company profile exposes only allowlisted contact fields and active social links', async () => {
  let query;
  const app = publicApp(createPublicPrisma({
    companyProfile: {
      findUnique: async (options) => {
        query = options;
        return {
          id: 1,
          name: 'Ztalent Coder',
          tagline: 'Learn and build',
          description: 'Public description',
          email: 'ztalentcoder@gmail.com',
          phone: '+255 622 923 299',
          location: 'Zanzibar',
          hours: 'Weekdays',
          logoUrl: 'https://example.test/logo.png',
          homeIntroImageUrl: '/uploads/images/company/123e4567-e89b-42d3-a456-426614174000.jpg',
          homeHeroImage1Url: '/uploads/images/company/hero-one.jpg',
          homeHeroImage2Url: '/uploads/images/company/hero-two.jpg',
          homeHeroImage3Url: '/uploads/images/company/hero-three.jpg',
          passwordHash: 'secret',
          socialLinks: [
            { platform: 'instagram', url: 'https://www.instagram.com/ztalentcoder/', isActive: true },
            { platform: 'facebook', url: 'https://www.facebook.com/ztalentcoder', isActive: true },
            { platform: 'whatsapp', url: 'https://wa.me/255622923299', isActive: true },
            { platform: 'youtube', url: 'https://www.youtube.com/@ztalentcoder', isActive: true },
          ],
        };
      },
    },
  }));
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/company-profile`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'success',
      item: {
        name: 'Ztalent Coder',
        tagline: 'Learn and build',
        description: 'Public description',
        email: 'ztalentcoder@gmail.com',
        phone: '+255 622 923 299',
        location: 'Zanzibar',
        hours: 'Weekdays',
        logoUrl: 'https://example.test/logo.png',
        homeIntroImageUrl: '/uploads/images/company/123e4567-e89b-42d3-a456-426614174000.jpg',
        homeHeroImage1Url: '/uploads/images/company/hero-one.jpg',
        homeHeroImage2Url: '/uploads/images/company/hero-two.jpg',
        homeHeroImage3Url: '/uploads/images/company/hero-three.jpg',
        socialLinks: [
          { platform: 'instagram', url: 'https://www.instagram.com/ztalentcoder/' },
          { platform: 'facebook', url: 'https://www.facebook.com/ztalentcoder' },
          { platform: 'whatsapp', url: 'https://wa.me/255622923299' },
          { platform: 'youtube', url: 'https://www.youtube.com/@ztalentcoder' },
        ],
      },
    });
  });
  assert.deepEqual(query.where, { id: 1 });
  assert.deepEqual(query.select.socialLinks.where, { isActive: true });
  assert.equal(Object.hasOwn(query.select, 'passwordHash'), false);
});

test('public statistics return active editable content and accurate published project and course counts', async () => {
  const queries = {};
  const app = publicApp(createPublicPrisma({
    siteStatistic: {
      findMany: async (options) => {
        queries.siteStatistic = options;
        return [
          { key: 'projects-delivered', label: 'Delivered', description: 'Project count', value: 91, suffix: null },
          { key: 'academic-courses', label: 'Courses', description: 'Course count', value: 92, suffix: null },
          { key: 'institutions-served', label: 'Institutions', description: 'Manual count', value: 14, suffix: null },
          { key: 'students-reached', label: 'Students', description: 'Manual count', value: 250, suffix: null },
        ];
      },
    },
    academicCourse: {
      count: async ({ where }) => { queries.academicCourse = where; return 1; },
    },
    project: {
      count: async ({ where }) => { queries.project = where; return 2; },
    },
  }));

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/statistics`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      status: 'success',
      statistics: [
        { key: 'projects-delivered', label: 'Delivered', description: 'Project count', value: 2 },
        { key: 'academic-courses', label: 'Courses', description: 'Course count', value: 1 },
        { key: 'institutions-served', label: 'Institutions', description: 'Manual count', value: 14 },
        { key: 'students-reached', label: 'Students', description: 'Manual count', value: 250 },
      ],
    });
    const legacy = await fetch(`${baseUrl}/api/public/site-statistics?pageSize=50`);
    assert.equal(legacy.status, 200);
    const legacyPayload = await legacy.json();
    assert.deepEqual(legacyPayload.items.map(({ key, value }) => ({ key, value })), [
      { key: 'projects-delivered', value: 2 },
      { key: 'academic-courses', value: 1 },
      { key: 'institutions-served', value: 14 },
      { key: 'students-reached', value: 250 },
    ]);
  });

  assert.deepEqual(queries.project, { status: 'PUBLISHED' });
  assert.deepEqual(queries.academicCourse, {
    status: 'PUBLISHED',
    category: { status: 'PUBLISHED' },
  });
  assert.deepEqual(queries.siteStatistic.where, {
    isActive: true,
    key: { in: ['projects-delivered', 'academic-courses', 'institutions-served', 'students-reached'] },
  });
});

test('public collections select published records, serialize explicit fields, and paginate', async () => {
  const seen = {};
  const app = publicApp(createPublicPrisma({
    project: {
      findMany: async (options) => {
        seen.options = options;
        return [{
          id: 'private-id',
          slug: 'public-project',
          title: 'Public project',
          summary: 'Summary',
          description: 'Description',
          imageUrl: null,
          status: 'PUBLISHED',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          publishedAt: new Date('2026-01-02T00:00:00Z'),
          businessArea: { slug: 'technology', name: 'Technology', status: 'PUBLISHED' },
          adminUser: { email: 'private@example.test' },
        }];
      },
      count: async ({ where }) => {
        seen.where = where;
        return 13;
      },
    },
  }));
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/projects?page=2&pageSize=5&businessArea=technology`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'success',
      items: [{
        slug: 'public-project',
        title: 'Public project',
        summary: 'Summary',
        description: 'Description',
        imageUrl: null,
        publishedAt: '2026-01-02T00:00:00.000Z',
        businessArea: { slug: 'technology', name: 'Technology' },
      }],
      pagination: { page: 2, pageSize: 5, total: 13, pageCount: 3 },
    });
  });
  assert.equal(seen.options.skip, 5);
  assert.equal(seen.options.take, 5);
  assert.deepEqual(seen.options.orderBy, [
    { sortOrder: 'asc' },
    { publishedAt: 'desc' },
    { createdAt: 'desc' },
  ]);
  assert.equal(seen.options.where.status, 'PUBLISHED');
  assert.deepEqual(seen.options.where.businessArea, { slug: 'technology', status: 'PUBLISHED' });
  assert.equal(seen.options.select.status, undefined);
  assert.equal(seen.options.select.adminUser, undefined);
});

test('unpublished and missing slug content both return a generic 404', async () => {
  const queried = [];
  const app = publicApp(createPublicPrisma({
    project: {
      findFirst: async (options) => {
        queried.push(options);
        return null;
      },
    },
    blogPost: {
      findFirst: async (options) => {
        queried.push(options);
        return null;
      },
    },
  }));
  await withServer(app, async (baseUrl) => {
    const unpublishedProject = await fetch(`${baseUrl}/api/public/projects/draft-project`);
    assert.equal(unpublishedProject.status, 404);
    assert.deepEqual(await unpublishedProject.json(), {
      error: { code: 'CONTENT_NOT_FOUND', message: 'The requested content was not found.' },
    });
    const response = await fetch(`${baseUrl}/api/public/blog-posts/draft-post`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: { code: 'CONTENT_NOT_FOUND', message: 'The requested content was not found.' },
    });
    const invalid = await fetch(`${baseUrl}/api/public/blog-posts/not%20a%20slug`);
    assert.equal(invalid.status, 404);
    assert.deepEqual(await invalid.json(), {
      error: { code: 'CONTENT_NOT_FOUND', message: 'The requested content was not found.' },
    });
  });
  assert.deepEqual(queried[0].where, { status: 'PUBLISHED', slug: 'draft-project' });
  assert.deepEqual(queried[1].where, {
    status: 'PUBLISHED',
    category: { status: 'PUBLISHED' },
    slug: 'draft-post',
  });
});

test('published-only resources enforce status filters and filter validation', async () => {
  const seen = [];
  const app = publicApp(createPublicPrisma({
    academicCourse: {
      findMany: async (options) => {
        seen.push(options);
        return [];
      },
      count: async () => 0,
    },
  }));
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/academic-courses?level=ADVANCED&pageSize=3`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).items, []);
    const invalid = await fetch(`${baseUrl}/api/public/academic-courses?level=ASSISTANT`);
    assert.equal(invalid.status, 400);
    const oversized = await fetch(`${baseUrl}/api/public/academic-courses?pageSize=500`);
    assert.equal(oversized.status, 400);
    const unknown = await fetch(`${baseUrl}/api/public/projects?status=DRAFT`);
    assert.equal(unknown.status, 400);
    const invalidSlugFilter = await fetch(`${baseUrl}/api/public/projects?businessArea=invalid%20slug`);
    assert.equal(invalidSlugFilter.status, 400);
  });
  assert.deepEqual(seen[0].where, {
    status: 'PUBLISHED',
    category: { status: 'PUBLISHED' },
    level: 'ADVANCED',
  });
  assert.equal(seen[0].take, 3);
});

test('public business areas expose only their approved image URL field', async () => {
  let optionsSeen;
  const app = publicApp(createPublicPrisma({
    businessArea: {
      findMany: async (options) => {
        optionsSeen = options;
        return [{
          id: 'private-id',
          slug: 'academic',
          name: 'Academic',
          summary: 'Learn to code.',
          description: 'Public description',
          imageUrl: '/uploads/images/business-areas/123e4567-e89b-42d3-a456-426614174000.webp',
          status: 'PUBLISHED',
          createdAt: new Date(),
        }];
      },
      count: async () => 1,
    },
  }));
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/business-areas`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).items, [{
      slug: 'academic',
      name: 'Academic',
      summary: 'Learn to code.',
      description: 'Public description',
      imageUrl: '/uploads/images/business-areas/123e4567-e89b-42d3-a456-426614174000.webp',
    }]);
  });
  assert.deepEqual(optionsSeen.select, {
    slug: true,
    name: true,
    summary: true,
    description: true,
    imageUrl: true,
  });
});

test('public services expose only published category services with safe icon data', async () => {
  let optionsSeen;
  const app = publicApp(createPublicPrisma({
    service: {
      findMany: async (options) => {
        optionsSeen = options;
        return [{
          id: 'private-id',
          slug: 'custom-software',
          title: 'Custom Software Development',
          summary: 'Software for your organization.',
          description: 'Plan and build software.',
          icon: '<script>',
          keyFeatures: ['Accessible', 'Maintainable'],
          status: 'PUBLISHED',
          businessArea: { slug: 'software-development', name: 'Software Development', status: 'PUBLISHED' },
          serviceCategory: { slug: 'software-development', name: 'Software Development', status: 'PUBLISHED' },
        }];
      },
      count: async () => 1,
    },
  }));
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/services`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).items, [{
      slug: 'custom-software',
      title: 'Custom Software Development',
      summary: 'Software for your organization.',
      description: 'Plan and build software.',
      icon: 'code',
      keyFeatures: ['Accessible', 'Maintainable'],
      businessArea: { slug: 'software-development', name: 'Software Development' },
      category: { slug: 'software-development', name: 'Software Development' },
    }]);
  });
  assert.deepEqual(optionsSeen.where, {
    status: 'PUBLISHED',
    businessArea: { status: 'PUBLISHED' },
    OR: [{ serviceCategoryId: null }, { serviceCategory: { status: 'PUBLISHED' } }],
  });
  assert.deepEqual(optionsSeen.select, {
    slug: true,
    title: true,
    summary: true,
    description: true,
    icon: true,
    keyFeatures: true,
    businessArea: { select: { slug: true, name: true, status: true } },
    serviceCategory: { select: { slug: true, name: true, status: true } },
  });
});

test('all public content collections constrain database reads to public records', async () => {
  const whereByModel = {};
  const names = ['businessArea', 'service', 'project', 'academicCourse', 'courseCategory', 'blogCategory', 'blogPost', 'teamMember', 'testimonial', 'siteStatistic'];
  const overrides = {};
  for (const name of names) {
    overrides[name] = {
      findMany: async ({ where }) => {
        whereByModel[name] = where;
        return [];
      },
      count: async () => 0,
    };
  }
  const app = publicApp(createPublicPrisma(overrides));
  const paths = [
    'business-areas',
    'services',
    'projects',
    'academic-courses',
    'course-categories',
    'blog-categories',
    'blog-posts',
    'team-members',
    'testimonials',
    'site-statistics',
  ];
  await withServer(app, async (baseUrl) => {
    for (const path of paths) {
      const response = await fetch(`${baseUrl}/api/public/${path}`);
      assert.equal(response.status, 200, path);
    }
  });
  for (const name of ['businessArea', 'service', 'project', 'academicCourse', 'blogPost', 'testimonial']) {
    assert.equal(whereByModel[name].status, 'PUBLISHED', name);
  }
  assert.deepEqual(whereByModel.service, {
    status: 'PUBLISHED',
    businessArea: { status: 'PUBLISHED' },
    OR: [{ serviceCategoryId: null }, { serviceCategory: { status: 'PUBLISHED' } }],
  });
  assert.deepEqual(whereByModel.teamMember, { status: 'PUBLISHED', photoUrl: { not: null } });
  assert.deepEqual(whereByModel.blogCategory, {
    status: 'PUBLISHED',
    posts: { some: { status: 'PUBLISHED' } },
  });
  assert.deepEqual(whereByModel.courseCategory, { status: 'PUBLISHED' });
  assert.deepEqual(whereByModel.siteStatistic, {
    isActive: true,
    key: { in: ['projects-delivered', 'academic-courses', 'institutions-served', 'students-reached'] },
  });
});

test('published project, blog, course, and business-area detail routes use slug allowlists', async () => {
  const seen = {};
  const app = publicApp(createPublicPrisma({
    project: {
      findFirst: async (options) => { seen.project = options; return { slug: 'public-project', title: 'Project', summary: 'Summary', description: 'Details', imageUrl: null, publishedAt: null, businessArea: null }; },
    },
    blogPost: {
      findFirst: async (options) => { seen.blogPost = options; return { slug: 'public-post', title: 'Post', excerpt: null, body: 'Body', coverImageUrl: null, publishedAt: null, category: { slug: 'news', name: 'News' } }; },
      findMany: async () => [],
    },
    academicCourse: {
      findFirst: async (options) => { seen.academicCourse = options; return { slug: 'public-course', title: 'Course', summary: null, level: 'BEGINNER', language: null, episodeCount: null, externalUrl: 'https://example.test/course', publishedAt: null }; },
    },
    businessArea: {
      findFirst: async (options) => { seen.businessArea = options; return { slug: 'public-area', name: 'Area', summary: null, description: 'Area description' }; },
    },
  }));
  await withServer(app, async (baseUrl) => {
    for (const [path, slug] of [
      ['projects', 'public-project'],
      ['blog-posts', 'public-post'],
      ['academic-courses', 'public-course'],
      ['business-areas', 'public-area'],
    ]) {
      const response = await fetch(`${baseUrl}/api/public/${path}/${slug}`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).item.slug, slug);
    }
  });
  for (const model of ['project', 'blogPost', 'academicCourse', 'businessArea']) {
    const expectedWhere = model === 'academicCourse'
      ? { slug: seen[model].where.slug, status: 'PUBLISHED', category: { status: 'PUBLISHED' } }
      : { slug: seen[model].where.slug, status: 'PUBLISHED' };
    if (model === 'blogPost') expectedWhere.category = { status: 'PUBLISHED' };
    assert.deepEqual(seen[model].where, expectedWhere);
    assert.equal(seen[model].select.passwordHash, undefined);
    assert.equal(seen[model].select.tokenHash, undefined);
  }
});

test('published project details include ordered structured content and explicitly serialize gallery images', async () => {
  let projectQuery;
  const project = {
    slug: 'detailed-project',
    title: 'Detailed Project',
    summary: 'A project summary.',
    description: 'Project overview.',
    imageUrl: '/uploads/images/projects/cover.png',
    publishedAt: null,
    businessArea: null,
    problemStatement: 'A real problem.',
    solution: 'An appropriate solution.',
    outcome: 'A positive impact.',
    liveUrl: 'https://example.test/project',
    technologies: ['React', 'PostgreSQL'],
    keyFeatures: [
      { title: 'First', description: 'First details.', sortOrder: 0 },
      { title: 'Second', description: 'Second details.', sortOrder: 1 },
    ],
    galleryImages: [
      { imageUrl: '/uploads/images/projects/one.png', sortOrder: 0 },
      { imageUrl: '/uploads/images/projects/two.png', sortOrder: 1 },
    ],
  };
  const app = publicApp(createPublicPrisma({
    project: {
      findFirst: async (options) => {
        projectQuery = options;
        return project;
      },
    },
  }));

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/projects/detailed-project`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).item, {
      slug: 'detailed-project',
      title: 'Detailed Project',
      summary: 'A project summary.',
      description: 'Project overview.',
      imageUrl: '/uploads/images/projects/cover.png',
      publishedAt: null,
      businessArea: null,
      problemStatement: 'A real problem.',
      solution: 'An appropriate solution.',
      keyFeatures: [
        { title: 'First', description: 'First details.' },
        { title: 'Second', description: 'Second details.' },
      ],
      technologies: ['React', 'PostgreSQL'],
      outcome: 'A positive impact.',
      galleryImages: [
        '/uploads/images/projects/one.png',
        '/uploads/images/projects/two.png',
      ],
      liveUrl: 'https://example.test/project',
    });
  });
  assert.deepEqual(projectQuery.where, { slug: 'detailed-project', status: 'PUBLISHED' });
  assert.deepEqual(projectQuery.select.keyFeatures.orderBy, { sortOrder: 'asc' });
  assert.deepEqual(projectQuery.select.galleryImages.orderBy, { sortOrder: 'asc' });
  assert.deepEqual(projectQuery.select.keyFeatures.select, {
    title: true,
    description: true,
    sortOrder: true,
  });
  assert.deepEqual(projectQuery.select.galleryImages.select, { imageUrl: true, sortOrder: true });
});

test('blog categories require published posts and related records are serialized safely', async () => {
  const seen = {};
  const app = publicApp(createPublicPrisma({
    blogCategory: {
      findMany: async (options) => {
        seen.category = options;
        return [{ slug: 'updates', name: 'Updates', description: null, _count: { posts: 4 } }];
      },
      count: async () => 1,
    },
    testimonial: {
      findMany: async (options) => {
        seen.testimonial = options;
        return [{
          quote: 'Good work',
          attributionName: 'Client',
          attributionOrganization: null,
          project: { slug: 'hidden-project', title: 'Hidden project', status: 'DRAFT' },
          status: 'PUBLISHED',
        }];
      },
      count: async () => 1,
    },
  }));
  await withServer(app, async (baseUrl) => {
    const categories = await fetch(`${baseUrl}/api/public/blog-categories`);
    assert.deepEqual((await categories.json()).items, [{
      slug: 'updates',
      name: 'Updates',
      description: null,
      postCount: 4,
    }]);
    const testimonials = await fetch(`${baseUrl}/api/public/testimonials`);
    assert.deepEqual((await testimonials.json()).items, [{
      quote: 'Good work',
      attributionName: 'Client',
      attributionOrganization: null,
      project: null,
    }]);
  });
  assert.deepEqual(seen.category.where, {
    status: 'PUBLISHED',
    posts: { some: { status: 'PUBLISHED' } },
  });
  assert.equal(seen.testimonial.where.status, 'PUBLISHED');
  assert.equal(seen.testimonial.select.status, undefined);
});

test('blog listing validates combined filters, applies publication constraints, and serializes editorial fields', async () => {
  const seen = {};
  const article = {
    slug: 'public-article',
    title: 'AI for good',
    excerpt: 'A practical AI story.',
    body: 'A short body',
    coverImageUrl: '/uploads/images/blog/12345678-1234-4123-8123-123456789012.png',
    coverImageAlt: 'AI dashboard',
    author: 'Editorial Team',
    readingTimeMinutes: null,
    isFeatured: true,
    seoTitle: 'AI guide',
    metaDescription: 'A useful guide.',
    publishedAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: new Date('2026-01-03T00:00:00Z'),
    category: { slug: 'data-ai', name: 'Data & AI' },
  };
  const regularArticle = { ...article, slug: 'regular-article', title: 'Regular article', isFeatured: false };
  const app = publicApp(createPublicPrisma({
    blogPost: {
      findMany: async (options) => { seen.list = options; return [article, regularArticle]; },
      count: async (options) => { seen.count = options; return 7; },
    },
  }));

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/blog-posts?page=2&pageSize=3&category=data-ai&search=AI`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.pagination, { page: 2, pageSize: 3, total: 7, pageCount: 3 });
    assert.deepEqual(payload.items[0], {
      slug: 'public-article',
      title: 'AI for good',
      excerpt: 'A practical AI story.',
      body: 'A short body',
      coverImageUrl: article.coverImageUrl,
      coverImageAlt: 'AI dashboard',
      author: 'Editorial Team',
      readingTimeMinutes: 1,
      seoTitle: 'AI guide',
      metaDescription: 'A useful guide.',
      publishedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
      category: { slug: 'data-ai', name: 'Data & AI' },
    });
    assert.deepEqual(payload.items.map(({ slug }) => slug), ['public-article', 'regular-article']);
    assert.equal(payload.items[1].isFeatured, undefined);
  });

  const expectedWhere = {
    status: 'PUBLISHED',
    category: { slug: 'data-ai', status: 'PUBLISHED' },
    OR: ['title', 'excerpt', 'body'].map((field) => ({
      [field]: { contains: 'AI', mode: 'insensitive' },
    })),
  };
  assert.deepEqual(seen.list.where, expectedWhere);
  assert.deepEqual(seen.count.where, expectedWhere);
  assert.equal(seen.list.skip, 3);
  assert.equal(seen.list.take, 3);
  assert.equal(seen.list.where.isFeatured, undefined);
  assert.equal(seen.list.select.isFeatured, undefined);
  assert.deepEqual(seen.list.orderBy, [
    { publishedAt: 'desc' },
    { createdAt: 'desc' },
  ]);
  assert.equal(seen.list.select.status, undefined);
});

test('published blog detail and related articles do not expose featured state', async () => {
  const seen = {};
  const article = {
    slug: 'published-article',
    title: 'Published Article',
    excerpt: 'An excerpt.',
    body: 'Body content',
    coverImageUrl: null,
    coverImageAlt: null,
    author: 'Editor',
    readingTimeMinutes: 3,
    isFeatured: true,
    seoTitle: null,
    metaDescription: null,
    publishedAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
    categoryId: 'category-id',
    category: { slug: 'technology', name: 'Technology' },
  };
  const related = {
    ...article,
    slug: 'related-article',
    title: 'Related Article',
    isFeatured: false,
  };
  const app = publicApp(createPublicPrisma({
    blogPost: {
      findFirst: async (options) => {
        seen.detail = options;
        return article;
      },
      findMany: async (options) => {
        if (options.where.slug?.not) {
          seen.related = options;
          return [related];
        }
        return [];
      },
    },
  }));

  await withServer(app, async (baseUrl) => {
    const detailResponse = await fetch(`${baseUrl}/api/public/blog-posts/published-article`);
    assert.equal(detailResponse.status, 200);
    const detail = (await detailResponse.json()).item;
    assert.deepEqual(detail.relatedPosts.map(({ slug }) => slug), ['related-article']);
    assert.equal(detail.isFeatured, undefined);
    assert.equal(detail.relatedPosts[0].isFeatured, undefined);
  });

  assert.deepEqual(seen.detail.where, {
    status: 'PUBLISHED',
    category: { status: 'PUBLISHED' },
    slug: 'published-article',
  });
  assert.deepEqual(seen.related.where, {
    status: 'PUBLISHED',
    category: { status: 'PUBLISHED' },
    categoryId: 'category-id',
    slug: { not: 'published-article' },
  });
});

test('public database errors are returned as a safe generic response', async () => {
  const app = publicApp(createPublicPrisma({
    teamMember: {
      findMany: async () => { throw new Error('database connection string and details'); },
      count: async () => 0,
    },
  }));
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/team-members`);
    assert.equal(response.status, 500);
    const body = await response.text();
    assert.equal(body.includes('database connection string'), false);
    assert.deepEqual(JSON.parse(body), {
      error: {
        code: 'PUBLIC_CONTENT_UNAVAILABLE',
        message: 'Public content is temporarily unavailable.',
      },
    });
  });
});

test('public content API does not expose write operations', async () => {
  await withServer(publicApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/projects`, { method: 'POST' });
    assert.equal(response.status, 404);
  });
});

test('public About page returns active sections and values in display order without admin metadata', async () => {
  const content = structuredClone(DEFAULT_ABOUT_PAGE_CONTENT);
  content.story.isActive = false;
  content.closing.sortOrder = 0;
  content.whoWeAre.sortOrder = 8;
  content.coreValues.values[0].isActive = false;
  content.coreValues.values[1].sortOrder = 8;
  content.coreValues.values[2].sortOrder = 0;
  let query;
  const app = publicApp(createPublicPrisma({
    aboutPageContent: {
      findUnique: async (options) => {
        query = options;
        return { content };
      },
    },
  }));
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/about-page`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const { item } = await response.json();
    assert.deepEqual(Object.keys(item), ['missionVision', 'coreValues', 'philosophy', 'team', 'whoWeAre']);
    assert.deepEqual(item.coreValues.values.map(({ title }) => title), ['INTEGRITY', 'COLLABORATION', 'CONTINUOUS LEARNING', 'IMPACT', 'EXCELLENCE']);
    assert.equal(Object.hasOwn(item.whoWeAre, 'isActive'), false);
    assert.equal(Object.hasOwn(item.whoWeAre, 'sortOrder'), false);
    assert.equal(item.whoWeAre.displayOrder, 8);
    assert.equal(Object.hasOwn(item.coreValues.values[0], 'isActive'), false);
    assert.equal(Object.hasOwn(item, 'closing'), false);
  });
  assert.deepEqual(query, { where: { id: 1 }, select: { content: true } });
});

test('public team members expose only the card fields and an optional portfolio URL', async () => {
  let query;
  const app = publicApp(createPublicPrisma({
    teamMember: {
      findMany: async (options) => {
        query = options;
        return [{
          name: 'Ada Example',
          role: 'Lead Engineer',
          photoUrl: 'https://images.example.test/ada.webp',
          portfolioUrl: 'https://ada.example.test',
          photoPosition: 18,
          bio: 'Private biography',
          linkedinUrl: 'https://linkedin.example/ada',
          githubUrl: 'https://github.example/ada',
        }, {
          name: 'Grace Example',
          role: 'Designer',
          photoUrl: 'https://images.example.test/grace.webp',
          portfolioUrl: null,
          photoPosition: null,
          bio: 'Another private biography',
        }];
      },
      count: async () => 2,
    },
  }));

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/public/team-members`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.items, [{
      name: 'Ada Example',
      role: 'Lead Engineer',
      photoUrl: 'https://images.example.test/ada.webp',
      portfolioUrl: 'https://ada.example.test',
      photoPosition: 18,
    }, {
      name: 'Grace Example',
      role: 'Designer',
      photoUrl: 'https://images.example.test/grace.webp',
      portfolioUrl: null,
      photoPosition: 35,
    }]);
  });
  assert.deepEqual(query.select, { name: true, role: true, photoUrl: true, portfolioUrl: true, photoPosition: true });
  assert.deepEqual(query.where, { status: 'PUBLISHED', photoUrl: { not: null } });
});
