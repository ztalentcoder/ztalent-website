import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from './helpers.js';
import { withServer } from './helpers.js';
import { DEFAULT_ABOUT_PAGE_CONTENT } from '../src/services/about-page-content.js';

const resourceModels = [
  'companyProfile',
  'aboutPageContent',
  'socialLink',
  'businessArea',
  'service',
  'serviceCategory',
  'project',
  'academicCourse',
  'courseCategory',
  'courseEpisode',
  'blogCategory',
  'blogPost',
  'teamMember',
  'testimonial',
  'siteStatistic',
  'contactMessage',
];

function createCmsPrisma({ role = 'EDITOR', overrides = {} } = {}) {
  const prisma = {
    adminSession: {
      findUnique: async () => ({
        id: 'session-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        adminUser: {
          id: 'admin-id',
          name: 'CMS Admin',
          email: 'admin@example.com',
          role,
          isActive: true,
        },
      }),
      update: async () => ({}),
    },
  };
  for (const model of resourceModels) {
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
      upsert: async ({ create }) => ({ ...create, socialLinks: [] }),
    };
  }
  prisma.$transaction = async (operations) => Promise.all(operations);
  Object.assign(prisma, overrides);
  return prisma;
}

function cmsApp(options) {
  return createApp({
    prismaClient: createCmsPrisma(options),
    frontendOrigin: 'http://frontend.test',
  });
}

function adminHeaders() {
  return { Cookie: `admin_session=${'d'.repeat(64)}` };
}

test('CMS collections use the standard items and pagination response', async () => {
  const optionsSeen = [];
  const prisma = createCmsPrisma({
    overrides: {
      businessArea: {
        findMany: async (options) => {
          optionsSeen.push(options);
          return [{ id: 'area-id', name: 'Research' }];
        },
        count: async (options) => {
          optionsSeen.push(options);
          return 3;
        },
      },
    },
  });

  await withServer(createApp({ prismaClient: prisma, frontendOrigin: 'http://frontend.test' }), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/admin/business-areas?page=2&pageSize=1&status=PUBLISHED&search=research`,
      { headers: adminHeaders() },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'success',
      items: [{ id: 'area-id', name: 'Research' }],
      pagination: { page: 2, pageSize: 1, total: 3, pageCount: 3 },
    });
  });

  assert.deepEqual(optionsSeen[0].where, {
    status: 'PUBLISHED',
    OR: ['name', 'slug', 'summary', 'description'].map((field) => ({
      [field]: { contains: 'research', mode: 'insensitive' },
    })),
  });
  assert.equal(optionsSeen[0].skip, 1);
  assert.equal(optionsSeen[0].take, 1);
});

test('admin project listing paginates all publication states in configured order with project relations', async () => {
  const projects = Array.from({ length: 12 }, (_, index) => ({
    id: `project-${index + 1}`,
    sortOrder: index,
    status: index % 2 === 0 ? 'PUBLISHED' : 'DRAFT',
    keyFeatures: index === 0
      ? [{ id: 'feature-1', title: 'Feature', description: 'Optional detail.', sortOrder: 0 }]
      : [],
    galleryImages: index === 0
      ? [{ id: 'gallery-1', imageUrl: '/uploads/images/projects/example.webp', sortOrder: 0 }]
      : [],
  }));
  const listOptions = [];
  const countOptions = [];
  const base = createCmsPrisma();
  const prisma = createCmsPrisma({
    overrides: {
      project: {
        ...base.project,
        findMany: async (options) => {
          listOptions.push(options);
          return projects.slice(options.skip, options.skip + options.take);
        },
        count: async (options) => {
          countOptions.push(options);
          return projects.length;
        },
      },
    },
  });

  await withServer(createApp({ prismaClient: prisma, frontendOrigin: 'http://frontend.test' }), async (baseUrl) => {
    const firstPage = await fetch(`${baseUrl}/api/admin/projects?page=1&pageSize=10`, {
      headers: adminHeaders(),
    });
    assert.equal(firstPage.status, 200);
    const firstPageBody = await firstPage.json();
    assert.deepEqual(firstPageBody.items.map(({ id }) => id), projects.slice(0, 10).map(({ id }) => id));
    assert.deepEqual(firstPageBody.pagination, { page: 1, pageSize: 10, total: 12, pageCount: 2 });
    assert.deepEqual(firstPageBody.items[0].keyFeatures, projects[0].keyFeatures);
    assert.deepEqual(firstPageBody.items[0].galleryImages, projects[0].galleryImages);
    assert.deepEqual(new Set(firstPageBody.items.map(({ status }) => status)), new Set(['PUBLISHED', 'DRAFT']));

    const secondPage = await fetch(`${baseUrl}/api/admin/projects?page=2&pageSize=10`, {
      headers: adminHeaders(),
    });
    assert.equal(secondPage.status, 200);
    const secondPageBody = await secondPage.json();
    assert.deepEqual(secondPageBody.items.map(({ id }) => id), projects.slice(10).map(({ id }) => id));
    assert.deepEqual(secondPageBody.pagination, { page: 2, pageSize: 10, total: 12, pageCount: 2 });
  });

  assert.deepEqual(listOptions.map(({ skip, take, orderBy, include }) => ({ skip, take, orderBy, include })), [
    {
      skip: 0,
      take: 10,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        keyFeatures: { orderBy: { sortOrder: 'asc' } },
        galleryImages: { orderBy: { sortOrder: 'asc' } },
      },
    },
    {
      skip: 10,
      take: 10,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        keyFeatures: { orderBy: { sortOrder: 'asc' } },
        galleryImages: { orderBy: { sortOrder: 'asc' } },
      },
    },
  ]);
  assert.deepEqual(countOptions, [{ where: {} }, { where: {} }]);
});

test('admin project listing handles an empty database and rejects invalid or unauthorized requests', async () => {
  let projectQueries = 0;
  const base = createCmsPrisma();
  const prisma = createCmsPrisma({
    overrides: {
      project: {
        ...base.project,
        findMany: async () => {
          projectQueries += 1;
          return [];
        },
        count: async () => 0,
      },
    },
  });

  await withServer(createApp({ prismaClient: prisma, frontendOrigin: 'http://frontend.test' }), async (baseUrl) => {
    const empty = await fetch(`${baseUrl}/api/admin/projects?page=1&pageSize=10`, {
      headers: adminHeaders(),
    });
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), {
      status: 'success',
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, pageCount: 0 },
    });

    const invalidPage = await fetch(`${baseUrl}/api/admin/projects?page=0&pageSize=10`, {
      headers: adminHeaders(),
    });
    assert.equal(invalidPage.status, 400);

    const invalidPageSize = await fetch(`${baseUrl}/api/admin/projects?page=1&pageSize=101`, {
      headers: adminHeaders(),
    });
    assert.equal(invalidPageSize.status, 400);

    const unauthorized = await fetch(`${baseUrl}/api/admin/projects?page=1&pageSize=10`);
    assert.equal(unauthorized.status, 401);
  });

  assert.equal(projectQueries, 1);
});

test('admin project listing returns an error instead of masking Prisma failures as empty results', async () => {
  const base = createCmsPrisma();
  const prisma = createCmsPrisma({
    overrides: {
      project: {
        ...base.project,
        findMany: async () => {
          throw Object.assign(new Error('database column detail'), { code: 'P2022' });
        },
        count: async () => 1,
      },
    },
  });

  await withServer(createApp({ prismaClient: prisma, frontendOrigin: 'http://frontend.test' }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/projects?page=1&pageSize=10`, {
      headers: adminHeaders(),
    });
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
    assert.doesNotMatch(JSON.stringify(body), /P2022|database column detail/);
    assert.equal(Object.hasOwn(body, 'items'), false);
  });
});

test('CMS mutations validate fields, normalize slugs, and return standard item responses', async () => {
  let created;
  let updated;
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        businessArea: {
          findUnique: async () => null,
          create: async ({ data }) => {
            created = data;
            return { id: 'area-id', ...data };
          },
          update: async ({ data }) => {
            updated = data;
            return { id: '123e4567-e89b-42d3-a456-426614174000', ...data };
          },
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/business-areas`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Research',
        slug: ' Research-Team ',
        description: 'Research and data.',
        imageUrl: 'https://cdn.example.test/research.jpg',
        status: 'DRAFT',
      }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      status: 'success',
      item: {
        id: 'area-id',
        name: 'Research',
        slug: 'research-team',
        description: 'Research and data.',
        imageUrl: 'https://cdn.example.test/research.jpg',
        status: 'DRAFT',
      },
    });

    const editResponse = await fetch(
      `${baseUrl}/api/admin/business-areas/123e4567-e89b-42d3-a456-426614174000`,
      {
        method: 'PATCH',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: 'https://cdn.example.test/research-updated.jpg' }),
      },
    );
    assert.equal(editResponse.status, 200);
    assert.deepEqual(updated, { imageUrl: 'https://cdn.example.test/research-updated.jpg' });

    const managedPath = '/uploads/images/business-areas/123e4567-e89b-42d3-a456-426614174000.webp';
    const managedImageResponse = await fetch(
      `${baseUrl}/api/admin/business-areas/123e4567-e89b-42d3-a456-426614174000`,
      {
        method: 'PATCH',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: managedPath }),
      },
    );
    assert.equal(managedImageResponse.status, 200);
    assert.deepEqual(updated, { imageUrl: managedPath });
  });
  assert.equal(created.slug, 'research-team');

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/business-areas`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bad', slug: 'bad slug', description: 'x', status: 'DRAFT' }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/business-areas`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unsafe image',
        slug: 'unsafe-image',
        description: 'Image URL validation',
        imageUrl: 'javascript:alert(1)',
        status: 'DRAFT',
      }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  });
});

test('statistics CMS edits manual values and content but protects calculated counts and fixed records', async () => {
  const automaticId = '123e4567-e89b-42d3-a456-426614174000';
  const manualId = '123e4567-e89b-42d3-a456-426614174001';
  const updates = [];
  const app = cmsApp({
    overrides: {
      siteStatistic: {
        ...createCmsPrisma().siteStatistic,
        findUnique: async ({ where }) => ({
          id: where.id,
          key: where.id === automaticId ? 'projects-delivered' : 'institutions-served',
        }),
        update: async ({ where, data }) => {
          updates.push({ where, data });
          return { id: where.id, ...data };
        },
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const update = (id, body, method = 'PATCH') => fetch(`${baseUrl}/api/admin/site-statistics/${id}`, {
      method,
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const contentUpdate = await update(automaticId, {
      label: 'Projects Delivered',
      description: 'Solutions shipped.',
      sortOrder: 1,
      isActive: true,
    });
    assert.equal(contentUpdate.status, 200);

    const manualValueUpdate = await update(manualId, { value: 42 });
    assert.equal(manualValueUpdate.status, 200);

    const fakeCount = await update(automaticId, { value: 999 });
    assert.equal(fakeCount.status, 400);
    assert.equal((await fakeCount.json()).error.code, 'VALIDATION_ERROR');

    const changeKey = await update(automaticId, { key: 'students-reached' });
    assert.equal(changeKey.status, 400);

    const create = await fetch(`${baseUrl}/api/admin/site-statistics`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'extra', label: 'Extra', description: 'Extra', value: 1 }),
    });
    assert.equal(create.status, 405);

    const remove = await fetch(`${baseUrl}/api/admin/site-statistics/${automaticId}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    assert.equal(remove.status, 405);
  });

  assert.deepEqual(updates, [
    {
      where: { id: automaticId },
      data: { label: 'Projects Delivered', description: 'Solutions shipped.', sortOrder: 1, isActive: true },
    },
    { where: { id: manualId }, data: { value: 42 } },
  ]);
});

test('CMS routes require authentication and allow only editor roles for content', async () => {
  await withServer(cmsApp({}), async (baseUrl) => {
    const unauthenticated = await fetch(`${baseUrl}/api/admin/business-areas`);
    assert.equal(unauthenticated.status, 401);

    const response = await fetch(`${baseUrl}/api/admin/business-areas`, { headers: adminHeaders() });
    assert.equal(response.status, 200);
  });
});

test('contact-message access is super-admin only and status updates are restricted', async () => {
  await withServer(cmsApp({ role: 'EDITOR' }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/contact-messages`, { headers: adminHeaders() });
    assert.equal(response.status, 403);
  });

  let updateOptions;
  const app = createApp({
    prismaClient: createCmsPrisma({
      role: 'SUPER_ADMIN',
      overrides: {
        contactMessage: {
          ...createCmsPrisma().contactMessage,
          update: async (options) => {
            updateOptions = options;
            return { id: options.where.id, ...options.data };
          },
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/contact-messages/123e4567-e89b-42d3-a456-426614174000`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'READ' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'success',
      item: { id: '123e4567-e89b-42d3-a456-426614174000', status: 'READ' },
    });
  });
  assert.deepEqual(updateOptions.data, { status: 'READ' });
});

test('dashboard returns actual counts using frontend count keys', async () => {
  const values = {
    businessArea: 1,
    service: 2,
    project: 3,
    blogPost: 4,
    teamMember: 5,
    contactMessage: 6,
  };
  const overrides = {};
  for (const [model, value] of Object.entries(values)) {
    overrides[model] = { count: async ({ where } = {}) => where?.status === 'NEW' ? 7 : value };
  }
  await withServer(cmsApp({ role: 'SUPER_ADMIN', overrides }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/dashboard`, { headers: adminHeaders() });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'success',
      counts: {
        businessAreas: 1,
        services: 2,
        projects: 3,
        blogPosts: 4,
        teamMembers: 5,
        newContactMessages: 7,
      },
    });
  });
});

test('editor dashboard omits contact-message counts', async () => {
  let contactMessageCounted = false;
  await withServer(cmsApp({
    role: 'EDITOR',
    overrides: {
      contactMessage: {
        ...createCmsPrisma().contactMessage,
        count: async () => {
          contactMessageCounted = true;
          return 3;
        },
      },
    },
  }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/dashboard`, { headers: adminHeaders() });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(Object.hasOwn(body.counts, 'newContactMessages'), false);
  });
  assert.equal(contactMessageCounted, false);
});

test('known Prisma constraint errors map to safe client errors', async () => {
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        businessArea: {
          findUnique: async () => null,
          create: async () => {
            const error = new Error('database details');
            error.code = 'P2002';
            throw error;
          },
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/business-areas`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Research', slug: 'research', description: 'x', status: 'DRAFT' }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'DUPLICATE_RESOURCE');
  });
});

test('resource detail, update, and delete use validated identifiers and safe responses', async () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const calls = [];
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        project: {
          ...createCmsPrisma().project,
          findUnique: async (options) => {
            calls.push(['findUnique', options]);
            return { id, title: 'Published item', status: 'PUBLISHED' };
          },
          update: async (options) => {
            calls.push(['update', options]);
            return { id, ...options.data };
          },
          delete: async (options) => {
            calls.push(['delete', options]);
            return { id };
          },
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const detail = await fetch(`${baseUrl}/api/admin/projects/${id}`, { headers: adminHeaders() });
    assert.equal(detail.status, 200);
    assert.deepEqual((await detail.json()).item, {
      id,
      title: 'Published item',
      status: 'PUBLISHED',
    });

    const update = await fetch(`${baseUrl}/api/admin/projects/${id}`, {
      method: 'PUT',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ARCHIVED' }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual((await update.json()).item, { id, status: 'ARCHIVED' });

    const remove = await fetch(`${baseUrl}/api/admin/projects/${id}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    assert.equal(remove.status, 200);
    assert.deepEqual(await remove.json(), { status: 'success' });

    const invalidId = await fetch(`${baseUrl}/api/admin/projects/not-a-uuid`, { headers: adminHeaders() });
    assert.equal(invalidId.status, 400);
    assert.equal((await invalidId.json()).error.code, 'INVALID_ID');
  });

  assert.deepEqual(calls, [
    ['findUnique', {
      where: { id },
      include: {
        keyFeatures: { orderBy: { sortOrder: 'asc' } },
        galleryImages: { orderBy: { sortOrder: 'asc' } },
      },
    }],
    ['update', {
      where: { id },
      data: { status: 'ARCHIVED' },
      include: {
        keyFeatures: { orderBy: { sortOrder: 'asc' } },
        galleryImages: { orderBy: { sortOrder: 'asc' } },
      },
    }],
    ['delete', { where: { id } }],
  ]);
});

test('projects can be created without a business area and receive unique title-based slugs', async () => {
  const projects = [];
  const createCalls = [];
  const base = createCmsPrisma();
  const projectModel = {
    ...base.project,
    findUnique: async ({ where }) => where.id
      ? projects.find((project) => project.id === where.id) ?? null
      : projects.find((project) => project.slug === where.slug) ?? null,
    findFirst: async ({ where }) => projects.find((project) => (
      project.slug === where.slug && (!where.status || project.status === where.status)
    )) ?? null,
    findMany: async ({ where = {} }) => projects.filter((project) => (
      !where.status || project.status === where.status
    )),
    count: async ({ where = {} }) => projects.filter((project) => (
      !where.status || project.status === where.status
    )).length,
    update: async ({ where, data }) => {
      const project = projects.find((entry) => entry.id === where.id);
      Object.assign(project, data);
      return project;
    },
    create: async ({ data }) => {
      createCalls.push(data);
      const project = {
        id: `project-${projects.length + 1}`,
        businessAreaId: null,
        imageUrl: null,
        publishedAt: null,
        ...data,
      };
      projects.push(project);
      return project;
    },
  };
  const app = createApp({
    prismaClient: createCmsPrisma({ overrides: { project: projectModel } }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const create = (status) => fetch(`${baseUrl}/api/admin/projects`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Ztalent Coder Website',
        summary: 'A modern company website.',
        description: 'Project details.',
        status,
        sortOrder: 1,
      }),
    });

    const firstResponse = await create('PUBLISHED');
    assert.equal(firstResponse.status, 201);
    const first = (await firstResponse.json()).item;
    assert.equal(first.slug, 'ztalent-coder-website');
    assert.equal(first.businessAreaId, null);
    assert.equal(Object.hasOwn(createCalls[0], 'businessAreaId'), false);

    const duplicateResponse = await create('DRAFT');
    assert.equal(duplicateResponse.status, 201);
    const duplicate = (await duplicateResponse.json()).item;
    assert.equal(duplicate.slug, 'ztalent-coder-website-2');

    const adminList = await fetch(`${baseUrl}/api/admin/projects`, { headers: adminHeaders() });
    assert.equal(adminList.status, 200);
    assert.deepEqual((await adminList.json()).items.map(({ slug }) => slug), [
      'ztalent-coder-website',
      'ztalent-coder-website-2',
    ]);

    const publicList = await fetch(`${baseUrl}/api/public/projects`);
    assert.equal(publicList.status, 200);
    assert.deepEqual((await publicList.json()).items.map(({ slug }) => slug), ['ztalent-coder-website']);

    const detail = await fetch(`${baseUrl}/api/public/projects/ztalent-coder-website`);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).item.slug, 'ztalent-coder-website');

    const existing = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      businessAreaId: '123e4567-e89b-42d3-a456-426614174010',
      title: 'Legacy project',
      slug: 'legacy-project-url',
      summary: 'Existing summary.',
      description: 'Existing details.',
      imageUrl: null,
      status: 'PUBLISHED',
      sortOrder: 0,
      publishedAt: null,
    };
    projects.push(existing);
    const edit = await fetch(`${baseUrl}/api/admin/projects/${existing.id}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Renamed project' }),
    });
    assert.equal(edit.status, 200);
    const editedProject = (await edit.json()).item;
    assert.equal(editedProject.slug, 'legacy-project-url');
    assert.equal(editedProject.businessAreaId, existing.businessAreaId);

    const manualSlug = await fetch(`${baseUrl}/api/admin/projects`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Another project',
        slug: 'manually-entered',
        summary: 'Summary.',
        description: 'Details.',
        status: 'DRAFT',
      }),
    });
    assert.equal(manualSlug.status, 400);
    assert.equal((await manualSlug.json()).error.code, 'VALIDATION_ERROR');
  });

  assert.equal(createCalls.length, 2);
  assert.deepEqual(projects.slice(0, 2).map(({ businessAreaId }) => businessAreaId), [null, null]);
  assert.equal(projects[2].businessAreaId, '123e4567-e89b-42d3-a456-426614174010');
});

test('project CMS creates, replaces, preserves, and validates structured details and gallery images', async () => {
  const projectId = '123e4567-e89b-42d3-a456-426614174000';
  const galleryUrl = '/uploads/images/projects/123e4567-e89b-42d3-a456-426614174015.png';
  const projects = [];
  const createInputs = [];
  const updateInputs = [];
  const base = createCmsPrisma();
  const projectModel = {
    ...base.project,
    findUnique: async ({ where }) => where.id
      ? projects.find((project) => project.id === where.id) ?? null
      : projects.find((project) => project.slug === where.slug) ?? null,
    findFirst: async ({ where }) => projects.find((project) => (
      project.slug === where.slug && project.status === where.status
    )) ?? null,
    create: async ({ data }) => {
      createInputs.push(data);
      const { keyFeatures, galleryImages, ...fields } = data;
      const project = {
        id: projectId,
        ...fields,
        keyFeatures: keyFeatures?.create ?? [],
        galleryImages: galleryImages?.create ?? [],
      };
      projects.push(project);
      return project;
    },
    update: async ({ where, data }) => {
      updateInputs.push(data);
      const project = projects.find((item) => item.id === where.id);
      const { keyFeatures, galleryImages, ...fields } = data;
      Object.assign(project, fields);
      if (keyFeatures) project.keyFeatures = keyFeatures.create;
      if (galleryImages) project.galleryImages = galleryImages.create;
      return project;
    },
  };
  const app = createApp({
    prismaClient: createCmsPrisma({ overrides: { project: projectModel } }),
    frontendOrigin: 'http://frontend.test',
  });
  const details = {
    title: 'Structured project',
    summary: 'A project with detailed content.',
    description: 'The detailed overview.',
    problemStatement: 'A concrete problem.',
    solution: 'A tailored solution.',
    outcome: 'A positive outcome.',
    liveUrl: 'https://example.test/project',
    technologies: ['React', 'PostgreSQL'],
    keyFeatures: [
      { title: 'Accessible', description: 'Supports diverse users.' },
      { title: 'Responsive', description: 'Works across screen sizes.' },
    ],
    galleryImages: [{ imageUrl: galleryUrl }],
    status: 'PUBLISHED',
  };

  await withServer(app, async (baseUrl) => {
    const create = await fetch(`${baseUrl}/api/admin/projects`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    });
    assert.equal(create.status, 201);
    const created = (await create.json()).item;
    assert.equal(created.slug, 'structured-project');
    assert.equal(created.problemStatement, details.problemStatement);
    assert.equal(created.solution, details.solution);
    assert.equal(created.outcome, details.outcome);
    assert.deepEqual(created.technologies, details.technologies);
    assert.deepEqual(created.keyFeatures.map(({ title, sortOrder }) => ({ title, sortOrder })), [
      { title: 'Accessible', sortOrder: 0 },
      { title: 'Responsive', sortOrder: 1 },
    ]);
    assert.deepEqual(created.galleryImages.map(({ imageUrl, sortOrder }) => ({ imageUrl, sortOrder })), [
      { imageUrl: galleryUrl, sortOrder: 0 },
    ]);
    assert.deepEqual(createInputs[0].keyFeatures, {
      create: [
        { title: 'Accessible', description: 'Supports diverse users.', sortOrder: 0 },
        { title: 'Responsive', description: 'Works across screen sizes.', sortOrder: 1 },
      ],
    });

    const updateDetails = await fetch(`${baseUrl}/api/admin/projects/${projectId}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyFeatures: [{ title: 'Updated feature', description: 'New feature details.' }],
        galleryImages: [],
      }),
    });
    assert.equal(updateDetails.status, 200);
    const updated = (await updateDetails.json()).item;
    assert.deepEqual(updated.keyFeatures.map(({ title }) => title), ['Updated feature']);
    assert.deepEqual(updated.galleryImages, []);
    assert.deepEqual(updateInputs[0].keyFeatures.create, [
      { title: 'Updated feature', description: 'New feature details.', sortOrder: 0 },
    ]);

    const preserveOmittedRelations = await fetch(`${baseUrl}/api/admin/projects/${projectId}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome: 'A revised outcome.' }),
    });
    assert.equal(preserveOmittedRelations.status, 200);
    const preserved = (await preserveOmittedRelations.json()).item;
    assert.deepEqual(preserved.keyFeatures.map(({ title }) => title), ['Updated feature']);
    assert.deepEqual(preserved.galleryImages, []);

    const invalidFeature = await fetch(`${baseUrl}/api/admin/projects`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Invalid feature project',
        summary: 'Summary.',
        description: 'Overview.',
        status: 'DRAFT',
        keyFeatures: [{ title: '', description: 'Missing title.' }],
      }),
    });
    assert.equal(invalidFeature.status, 400);
    assert.equal((await invalidFeature.json()).error.code, 'VALIDATION_ERROR');
  });
});

test('blog CMS generates unique post slugs and prevents deleting categories with posts', async () => {
  const categoryId = '123e4567-e89b-42d3-a456-426614174030';
  const postIds = [
    '123e4567-e89b-42d3-a456-426614174040',
    '123e4567-e89b-42d3-a456-426614174041',
  ];
  const categories = [{ id: categoryId, name: 'Data & AI', slug: 'data-ai', status: 'PUBLISHED' }];
  const posts = [];
  let categoryData;
  let categoryDeleted = false;
  const base = createCmsPrisma();
  const app = cmsApp({
    overrides: {
      blogCategory: {
        ...base.blogCategory,
        findUnique: async ({ where }) => categories.find((category) => (
          (where.id && category.id === where.id) || (where.slug && category.slug === where.slug)
        )) ?? null,
        create: async ({ data }) => {
          categoryData = data;
          return { id: '123e4567-e89b-42d3-a456-426614174031', ...data };
        },
        delete: async () => { categoryDeleted = true; return {}; },
      },
      blogPost: {
        ...base.blogPost,
        findUnique: async ({ where }) => posts.find((post) => (
          (where.slug && post.slug === where.slug) || (where.id && post.id === where.id)
        )) ?? null,
        create: async ({ data }) => {
          const post = { id: postIds[posts.length], ...data };
          posts.push(post);
          return post;
        },
        update: async ({ where, data }) => {
          const post = posts.find((item) => item.id === where.id);
          Object.assign(post, data);
          return post;
        },
        count: async ({ where }) => posts.filter((post) => post.categoryId === where.categoryId).length,
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const categoryResponse = await fetch(`${baseUrl}/api/admin/blog-categories`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Engineering',
        slug: 'engineering',
        description: 'Engineering stories.',
        sortOrder: 3,
        status: 'PUBLISHED',
      }),
    });
    assert.equal(categoryResponse.status, 201);
    assert.equal(categoryData.sortOrder, 3);
    assert.equal(categoryData.status, 'PUBLISHED');

    const createPost = () => fetch(`${baseUrl}/api/admin/blog-posts`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId,
        title: 'AI for good',
        excerpt: 'A practical AI story.',
        body: 'A safe Markdown article.',
        author: 'Editorial Team',
        isFeatured: true,
        status: 'DRAFT',
      }),
    });
    const firstResponse = await createPost();
    assert.equal(firstResponse.status, 201);
    const first = (await firstResponse.json()).item;
    assert.equal(first.slug, 'ai-for-good');
    assert.equal(first.isFeatured, true);

    const duplicateResponse = await createPost();
    assert.equal(duplicateResponse.status, 201);
    assert.equal((await duplicateResponse.json()).item.slug, 'ai-for-good-2');

    const updateResponse = await fetch(`${baseUrl}/api/admin/blog-posts/${postIds[0]}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'AI for good, updated', author: 'Updated Editorial Team' }),
    });
    assert.equal(updateResponse.status, 200);
    const updated = (await updateResponse.json()).item;
    assert.equal(updated.title, 'AI for good, updated');
    assert.equal(updated.author, 'Updated Editorial Team');
    assert.equal(updated.slug, 'ai-for-good');

    const deleteCategory = await fetch(`${baseUrl}/api/admin/blog-categories/${categoryId}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    assert.equal(deleteCategory.status, 409);
    assert.equal((await deleteCategory.json()).error.code, 'CATEGORY_IN_USE');
    assert.equal(categoryDeleted, false);

    const unauthorized = await fetch(`${baseUrl}/api/admin/blog-posts`);
    assert.equal(unauthorized.status, 401);
  });

  assert.equal(posts.length, 2);
  assert.equal(posts.every((post) => post.status === 'DRAFT'), true);
  assert.equal(posts[0].categoryId, categoryId);
});

test('foreign-key and missing-record errors are sanitized', async () => {
  const validId = '123e4567-e89b-42d3-a456-426614174000';
  const serviceError = new Error('database relation detail');
  serviceError.code = 'P2003';
  const projectError = new Error('database record detail');
  projectError.code = 'P2025';
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        service: {
          findUnique: async () => null,
          create: async () => { throw serviceError; },
        },
        project: {
          delete: async () => { throw projectError; },
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const invalidRelation = await fetch(`${baseUrl}/api/admin/services`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessAreaId: validId,
        title: 'Research service',
        summary: 'Research tools.',
        slug: 'research-service',
        description: 'Service description',
        icon: 'code',
        status: 'DRAFT',
      }),
    });
    assert.equal(invalidRelation.status, 400);
    assert.deepEqual(await invalidRelation.json(), {
      error: {
        code: 'INVALID_RELATION',
        message: 'A related resource does not exist or cannot be changed.',
      },
    });

    const missingRecord = await fetch(`${baseUrl}/api/admin/projects/${validId}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    assert.equal(missingRecord.status, 404);
    const body = await missingRecord.text();
    assert.equal(body.includes('database record detail'), false);
  });
});

test('contact-message records cannot be deleted and publication filters are validated', async () => {
  await withServer(cmsApp({ role: 'SUPER_ADMIN' }), async (baseUrl) => {
    const invalidStatus = await fetch(`${baseUrl}/api/admin/projects?status=VISIBLE`, {
      headers: adminHeaders(),
    });
    assert.equal(invalidStatus.status, 400);
    assert.equal((await invalidStatus.json()).error.code, 'VALIDATION_ERROR');

    const deleteMessage = await fetch(`${baseUrl}/api/admin/contact-messages/123e4567-e89b-42d3-a456-426614174000`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    assert.equal(deleteMessage.status, 404);
    assert.equal((await deleteMessage.json()).error.code, 'NOT_FOUND');
  });
});

test('business areas and services receive unique generated slugs and retain safe editable fields', async () => {
  const categories = [];
  const services = [];
  const createSlugModel = (records, scoped = false) => ({
    findUnique: async ({ where }) => {
      if (where.id) return records.find((item) => item.id === where.id) ?? null;
      const unique = scoped ? where.businessAreaId_slug : where;
      return records.find((item) => item.slug === unique.slug
        && (!scoped || item.businessAreaId === unique.businessAreaId)) ?? null;
    },
    create: async ({ data }) => {
      if (records.some((item) => item.slug === data.slug
        && (!scoped || item.businessAreaId === data.businessAreaId))) {
        const error = new Error('unique constraint');
        error.code = 'P2002';
        throw error;
      }
      const item = {
        id: records.length === 0
          ? '123e4567-e89b-42d3-a456-426614174000'
          : '123e4567-e89b-42d3-a456-426614174001',
        ...data,
      };
      records.push(item);
      return item;
    },
    update: async ({ where, data }) => {
      const item = records.find((record) => record.id === where.id);
      Object.assign(item, data);
      return item;
    },
    delete: async ({ where }) => {
      const index = records.findIndex((record) => record.id === where.id);
      records.splice(index, 1);
      return {};
    },
  });
  const base = createCmsPrisma();
  const app = cmsApp({
    overrides: {
      businessArea: { ...base.businessArea, ...createSlugModel(categories) },
      service: {
        ...base.service,
        ...createSlugModel(services, true),
        count: async ({ where }) => services.filter((service) => service.businessAreaId === where.businessAreaId).length,
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const createCategory = () => fetch(`${baseUrl}/api/admin/business-areas`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Software Development', summary: 'Build software.', status: 'PUBLISHED' }),
    });
    const categoryResponses = await Promise.all([createCategory(), createCategory()]);
    assert.deepEqual(categoryResponses.map((response) => response.status), [201, 201]);
    assert.deepEqual(categories.map(({ slug }) => slug).sort(), ['software-development', 'software-development-2']);

    const createService = () => fetch(`${baseUrl}/api/admin/services`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessAreaId: '123e4567-e89b-42d3-a456-426614174000',
        title: 'Web Development',
        summary: 'Custom websites.',
        description: 'Build accessible web applications.',
        icon: 'code',
        keyFeatures: ['Accessible interfaces', 'Responsive layouts'],
        status: 'DRAFT',
      }),
    });
    const serviceResponses = await Promise.all([createService(), createService()]);
    assert.deepEqual(serviceResponses.map((response) => response.status), [201, 201]);
    assert.deepEqual(services.map(({ slug }) => slug).sort(), ['web-development', 'web-development-2']);
    assert.deepEqual(services[0].keyFeatures, ['Accessible interfaces', 'Responsive layouts']);

    const categoryEdit = await fetch(`${baseUrl}/api/admin/business-areas/123e4567-e89b-42d3-a456-426614174000`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Software Engineering', sortOrder: 1, status: 'DRAFT' }),
    });
    assert.equal(categoryEdit.status, 200);
    assert.equal(categories[0].slug, 'software-engineering');
    assert.equal(categories[0].sortOrder, 1);
    assert.equal(categories[0].status, 'DRAFT');

    const serviceId = '123e4567-e89b-42d3-a456-426614174000';
    const publishService = async (status, sortOrder) => fetch(`${baseUrl}/api/admin/services/${serviceId}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, sortOrder }),
    });
    assert.equal((await publishService('PUBLISHED', 2)).status, 200);
    assert.equal(services[0].status, 'PUBLISHED');
    assert.equal(services[0].sortOrder, 2);
    assert.equal((await publishService('DRAFT', 3)).status, 200);
    assert.equal((await publishService('ARCHIVED', 4)).status, 200);
    assert.equal(services[0].status, 'ARCHIVED');
    for (const service of [...services]) {
      const deleted = await fetch(`${baseUrl}/api/admin/services/${service.id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      assert.equal(deleted.status, 200);
    }
    assert.equal(services.length, 0);

    const invalidIcon = await fetch(`${baseUrl}/api/admin/services`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessAreaId: '123e4567-e89b-42d3-a456-426614174000',
        title: 'Invalid icon',
        summary: 'Summary',
        description: 'Description',
        icon: '<svg>',
        status: 'DRAFT',
      }),
    });
    assert.equal(invalidIcon.status, 400);
    assert.equal((await invalidIcon.json()).error.code, 'VALIDATION_ERROR');

    const deleteCategory = await fetch(`${baseUrl}/api/admin/business-areas/123e4567-e89b-42d3-a456-426614174000`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    assert.equal(deleteCategory.status, 200);
  });
});

test('scoped service management binds create and item mutations to its business area', async () => {
  const businessAreaId = '123e4567-e89b-42d3-a456-426614174000';
  const otherBusinessAreaId = '123e4567-e89b-42d3-a456-426614174001';
  const listOptions = [];
  const createdServices = [];
  const app = cmsApp({
    overrides: {
      service: {
        ...createCmsPrisma().service,
        findMany: async (options) => {
          listOptions.push(options);
          return [];
        },
        findUnique: async () => null,
        create: async ({ data }) => {
          createdServices.push(data);
          return { id: 'created-service', ...data };
        },
        count: async () => 0,
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const listResponse = await fetch(`${baseUrl}/api/admin/services?businessAreaId=${businessAreaId}`, {
      headers: adminHeaders(),
    });
    assert.equal(listResponse.status, 200);

    const createResponse = await fetch(`${baseUrl}/api/admin/services?businessAreaId=${businessAreaId}`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Data Engineering',
        summary: 'Reliable data pipelines.',
        icon: 'database',
        status: 'PUBLISHED',
      }),
    });
    assert.equal(createResponse.status, 201);
    assert.equal(createdServices[0].businessAreaId, businessAreaId);

    const mismatchedCreate = await fetch(`${baseUrl}/api/admin/services?businessAreaId=${businessAreaId}`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessAreaId: otherBusinessAreaId,
        title: 'Wrong area',
        summary: 'This assignment must be rejected.',
        icon: 'code',
        status: 'DRAFT',
      }),
    });
    assert.equal(mismatchedCreate.status, 404);
  });

  assert.deepEqual(listOptions[0].where, { businessAreaId });
});

test('business areas cannot be deleted while services or projects remain assigned', async () => {
  let deleted = false;
  const app = cmsApp({
    overrides: {
      service: { ...createCmsPrisma().service, count: async () => 1 },
      project: { ...createCmsPrisma().project, count: async () => 0 },
      businessArea: {
        ...createCmsPrisma().businessArea,
        delete: async () => { deleted = true; },
      },
    },
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/business-areas/123e4567-e89b-42d3-a456-426614174000`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error.message, /reassign or delete the services/i);
    assert.equal(deleted, false);
  });
});

test('services without a full description default it to the required short summary', async () => {
  let created;
  const base = createCmsPrisma();
  const app = cmsApp({
    overrides: {
      service: {
        ...base.service,
        findUnique: async () => null,
        create: async ({ data }) => {
          created = data;
          return { id: '123e4567-e89b-42d3-a456-426614174003', ...data };
        },
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/services`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessAreaId: '123e4567-e89b-42d3-a456-426614174000',
        title: 'Web Development',
        summary: 'Modern websites.',
        icon: 'code',
        status: 'PUBLISHED',
        sortOrder: 1,
        serviceCategoryId: null,
      }),
    });

    assert.equal(response.status, 201);
  });

  assert.equal(created.description, 'Modern websites.');
  assert.deepEqual(created.keyFeatures, []);
});

test('service categories are scoped to business areas, enforce assignments, and cannot be deleted while used', async () => {
  const areaId = '123e4567-e89b-42d3-a456-426614174000';
  const otherAreaId = '123e4567-e89b-42d3-a456-426614174002';
  const categoryId = '123e4567-e89b-42d3-a456-426614174001';
  const categories = [];
  const services = [];
  const categoryModel = {
    findUnique: async ({ where }) => {
      if (where.id) {
        const category = categories.find(({ id }) => id === where.id);
        return category
          ? {
            ...category,
            _count: { services: services.filter((service) => service.serviceCategoryId === category.id).length },
          }
          : null;
      }
      const unique = where.businessAreaId_slug ?? where;
      return categories.find((category) => category.slug === unique.slug
        && category.businessAreaId === unique.businessAreaId) ?? null;
    },
    findMany: async ({ where }) => {
      categoryListWhere = where;
      return categories;
    },
    count: async () => categories.length,
    create: async ({ data }) => {
      const category = { id: categoryId, ...data };
      categories.push(category);
      return category;
    },
    update: async ({ where, data }) => {
      const category = categories.find(({ id }) => id === where.id);
      Object.assign(category, data);
      return category;
    },
    delete: async ({ where }) => {
      const index = categories.findIndex(({ id }) => id === where.id);
      categories.splice(index, 1);
      return {};
    },
  };
  let serviceListWhere;
  const serviceModel = {
    findUnique: async ({ where }) => {
      if (where.id) return services.find(({ id }) => id === where.id) ?? null;
      const unique = where.businessAreaId_slug ?? where;
      return services.find((service) => service.slug === unique.slug
        && service.businessAreaId === unique.businessAreaId) ?? null;
    },
    findMany: async ({ where }) => {
      serviceListWhere = where;
      return services;
    },
    create: async ({ data }) => {
      const service = { id: '123e4567-e89b-42d3-a456-426614174003', ...data };
      services.push(service);
      return service;
    },
    count: async ({ where }) => services.filter((service) => (
      where.serviceCategoryId
        ? service.serviceCategoryId === where.serviceCategoryId
        : service.businessAreaId === where.businessAreaId
    )).length,
    delete: async ({ where }) => {
      const index = services.findIndex(({ id }) => id === where.id);
      services.splice(index, 1);
      return {};
    },
  };
  const base = createCmsPrisma();
  const app = cmsApp({
    overrides: {
      serviceCategory: { ...base.serviceCategory, ...categoryModel },
      service: { ...base.service, ...serviceModel },
    },
  });

  await withServer(app, async (baseUrl) => {
    const createCategory = (businessAreaId = areaId) => fetch(`${baseUrl}/api/admin/service-categories`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessAreaId, name: 'Software Development', status: 'PUBLISHED', sortOrder: 1 }),
    });
    const createdCategory = await createCategory();
    assert.equal(createdCategory.status, 201);
    assert.equal(categories[0].slug, 'software-development');

    const serviceBody = {
      businessAreaId: areaId,
      serviceCategoryId: categoryId,
      title: 'Web Development',
      summary: 'Modern websites.',
      description: 'Build accessible web applications.',
      status: 'PUBLISHED',
      sortOrder: 2,
    };
    const createdService = await fetch(`${baseUrl}/api/admin/services`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(serviceBody),
    });
    assert.equal(createdService.status, 201);
    assert.equal(services[0].serviceCategoryId, categoryId);

    const moveInUse = await fetch(`${baseUrl}/api/admin/service-categories/${categoryId}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessAreaId: otherAreaId }),
    });
    assert.equal(moveInUse.status, 409);

    const mismatch = await fetch(`${baseUrl}/api/admin/services`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...serviceBody, title: 'Wrong area', businessAreaId: otherAreaId }),
    });
    assert.equal(mismatch.status, 400);
    assert.match((await mismatch.json()).error.message, /belonging to the selected business area/i);

    const filterResponse = await fetch(`${baseUrl}/api/admin/services?serviceCategoryId=${categoryId}`, {
      headers: adminHeaders(),
    });
    assert.equal(filterResponse.status, 200);
    assert.deepEqual(serviceListWhere, { serviceCategoryId: categoryId });

    await fetch(`${baseUrl}/api/admin/service-categories/${categoryId}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DRAFT' }),
    });
    const publishWithDraftCategory = await fetch(`${baseUrl}/api/admin/services/${services[0].id}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    assert.equal(publishWithDraftCategory.status, 400);

    const deleteInUse = await fetch(`${baseUrl}/api/admin/service-categories/${categoryId}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    assert.equal(deleteInUse.status, 409);

    await fetch(`${baseUrl}/api/admin/services/${services[0].id}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    const deleteUnused = await fetch(`${baseUrl}/api/admin/service-categories/${categoryId}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    assert.equal(deleteUnused.status, 200);
  });
});

test('Tech Solutions filters and mutation guards do not expose or alter other categories', async () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const seen = {};
  const categoryUpdates = [];
  const serviceUpdates = [];
  const categoryDeletes = [];
  const app = cmsApp({
    overrides: {
      businessArea: {
        ...createCmsPrisma().businessArea,
        findMany: async ({ where }) => { seen.categoryWhere = where; return []; },
        count: async () => 0,
        findUnique: async () => ({ id, isTechSolution: false }),
        update: async (options) => { categoryUpdates.push(options); return {}; },
        delete: async (options) => { categoryDeletes.push(options); },
      },
      service: {
        ...createCmsPrisma().service,
        findMany: async ({ where }) => { seen.serviceWhere = where; return []; },
        count: async () => 0,
        findUnique: async () => ({ businessArea: { isTechSolution: false } }),
        update: async (options) => { serviceUpdates.push(options); return {}; },
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const categoryList = await fetch(`${baseUrl}/api/admin/business-areas?techSolutions=true`, {
      headers: adminHeaders(),
    });
    const serviceList = await fetch(`${baseUrl}/api/admin/services?techSolutions=true`, {
      headers: adminHeaders(),
    });
    assert.equal(categoryList.status, 200);
    assert.equal(serviceList.status, 200);
    assert.deepEqual(seen.categoryWhere, { isTechSolution: true, projects: { none: {} } });
    assert.deepEqual(seen.serviceWhere, {
      businessArea: { isTechSolution: true, projects: { none: {} } },
    });

    const categoryUpdate = await fetch(`${baseUrl}/api/admin/business-areas/${id}?techSolutions=true`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Other content' }),
    });
    const serviceUpdate = await fetch(`${baseUrl}/api/admin/services/${id}?techSolutions=true`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Other service' }),
    });
    const categoryDelete = await fetch(`${baseUrl}/api/admin/business-areas/${id}?techSolutions=true`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    assert.deepEqual([categoryUpdate.status, serviceUpdate.status, categoryDelete.status], [404, 404, 404]);
    assert.equal(categoryUpdates.length, 0);
    assert.equal(serviceUpdates.length, 0);
    assert.equal(categoryDeletes.length, 0);
  });
});

test('Tech Solutions cannot update categories or services shared with portfolio projects', async () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const updates = [];
  const app = cmsApp({
    overrides: {
      businessArea: {
        ...createCmsPrisma().businessArea,
        findUnique: async () => ({ isTechSolution: true, _count: { projects: 1 } }),
        update: async (options) => { updates.push(options); return {}; },
      },
      service: {
        ...createCmsPrisma().service,
        findUnique: async () => ({
          businessArea: { isTechSolution: true, _count: { projects: 1 } },
        }),
        update: async (options) => { updates.push(options); return {}; },
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const categoryResponse = await fetch(`${baseUrl}/api/admin/business-areas/${id}?techSolutions=true`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Shared category' }),
    });
    const serviceResponse = await fetch(`${baseUrl}/api/admin/services/${id}?techSolutions=true`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Shared service' }),
    });

    assert.deepEqual([categoryResponse.status, serviceResponse.status], [404, 404]);
    assert.equal(updates.length, 0);
  });
});

test('company profile singleton supports a validated create-or-update and includes social links', async () => {
  let upsertOptions;
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        companyProfile: {
          findUnique: async () => null,
          upsert: async (options) => {
            upsertOptions = options;
            return { ...options.create, socialLinks: [] };
          },
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/company-profile`, {
      method: 'PUT',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'ZTalent',
        email: 'INFO@ZTALENT.EXAMPLE',
        homeIntroImageUrl: '/uploads/images/company/123e4567-e89b-42d3-a456-426614174000.jpg',
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'success',
      item: {
        id: 1,
        name: 'ZTalent',
        email: 'info@ztalent.example',
        homeIntroImageUrl: '/uploads/images/company/123e4567-e89b-42d3-a456-426614174000.jpg',
        socialLinks: [],
      },
    });
  });
  assert.equal(upsertOptions.create.id, 1);
});

test('company profile PATCH validates and updates only submitted fields on the existing singleton', async () => {
  let profile = {
    id: 1,
    name: 'Ztalent Coder',
    tagline: 'Existing tagline',
    description: 'Existing description',
    email: 'old@example.test',
    phone: '+255 600 000 000',
    location: 'Dar es Salaam',
    hours: 'Weekdays',
    logoUrl: '/uploads/images/company/logo.jpg',
    homeIntroImageUrl: '/uploads/images/company/home.jpg',
    socialLinks: [{ platform: 'instagram', url: 'https://instagram.example/old' }],
  };
  const updates = [];
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        companyProfile: {
          findUnique: async () => profile,
          upsert: async ({ create, update }) => {
            updates.push(update);
            profile = { ...profile, ...create, ...update };
            return profile;
          },
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    for (const [field, value] of [
      ['phone', '+255 622 923 299'],
      ['email', 'ztalentcoder@gmail.com'],
      ['location', 'Zanzibar'],
    ]) {
      const response = await fetch(`${baseUrl}/api/admin/company-profile`, {
        method: 'PATCH',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).item[field], value);
      assert.deepEqual(updates.at(-1), { [field]: value });
    }

    const multipleResponse = await fetch(`${baseUrl}/api/admin/company-profile`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagline: 'Updated tagline', phone: '+255 700 000 000' }),
    });
    assert.equal(multipleResponse.status, 200);
    assert.deepEqual(updates.at(-1), { tagline: 'Updated tagline', phone: '+255 700 000 000' });

    const invalidResponse = await fetch(`${baseUrl}/api/admin/company-profile`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    assert.equal(invalidResponse.status, 400);
    assert.equal(updates.length, 4);

    const unauthorizedResponse = await fetch(`${baseUrl}/api/admin/company-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+255 000 000 000' }),
    });
    assert.equal(unauthorizedResponse.status, 401);
    assert.equal(updates.length, 4);
  });

  assert.equal(profile.name, 'Ztalent Coder');
  assert.equal(profile.email, 'ztalentcoder@gmail.com');
  assert.equal(profile.location, 'Zanzibar');
  assert.equal(profile.logoUrl, '/uploads/images/company/logo.jpg');
  assert.equal(profile.homeIntroImageUrl, '/uploads/images/company/home.jpg');
  assert.equal(profile.socialLinks[0].url, 'https://instagram.example/old');
});

test('company profile PATCH creates the singleton with a safe name when first saving a partial update', async () => {
  let upsertOptions;
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        companyProfile: {
          upsert: async (options) => {
            upsertOptions = options;
            return { ...options.create, ...options.update, socialLinks: [] };
          },
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/company-profile`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+255 622 923 299' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).item, {
      id: 1,
      name: 'Ztalent Coder',
      phone: '+255 622 923 299',
      socialLinks: [],
    });
  });
  assert.deepEqual(upsertOptions.create, { id: 1, name: 'Ztalent Coder', phone: '+255 622 923 299' });
  assert.deepEqual(upsertOptions.update, { phone: '+255 622 923 299' });
});

test('social-link management is scoped to the singleton company profile', async () => {
  let createOptions;
  let listOptions;
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        socialLink: {
          ...createCmsPrisma().socialLink,
          create: async (options) => {
            createOptions = options;
            return { id: 'social-id', ...options.data };
          },
          findMany: async (options) => {
            listOptions = options;
            return [{ id: 'social-id', companyProfileId: 1, platform: 'linkedin' }];
          },
          count: async () => 1,
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/admin/company-profile/social-links`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'linkedin', url: 'https://linkedin.example/company' }),
    });
    assert.equal(createResponse.status, 201);
    assert.equal((await createResponse.json()).item.companyProfileId, 1);

    const listResponse = await fetch(
      `${baseUrl}/api/admin/company-profile/social-links?search=link&isActive=true&pageSize=5`,
      { headers: adminHeaders() },
    );
    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), {
      status: 'success',
      items: [{ id: 'social-id', companyProfileId: 1, platform: 'linkedin' }],
      pagination: { page: 1, pageSize: 5, total: 1, pageCount: 1 },
    });
  });
  assert.deepEqual(createOptions.data, {
    companyProfileId: 1,
    platform: 'linkedin',
    url: 'https://linkedin.example/company',
  });
  assert.deepEqual(listOptions.where, {
    companyProfileId: 1,
    isActive: true,
    platform: { contains: 'link', mode: 'insensitive' },
  });
});

test('social-link creation rejects a duplicate platform regardless of case', async () => {
  let duplicateQuery;
  let creates = 0;
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        socialLink: {
          ...createCmsPrisma().socialLink,
          findFirst: async (options) => {
            duplicateQuery = options;
            return { id: 'existing-instagram' };
          },
          create: async () => { creates += 1; },
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/company-profile/social-links`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'Instagram', url: 'https://instagram.com/another' }),
    });
    assert.equal(response.status, 409);
    assert.equal(creates, 0);
  });
  assert.deepEqual(duplicateQuery.where, {
    companyProfileId: 1,
    platform: { equals: 'instagram', mode: 'insensitive' },
  });
});

test('social-link creation initializes a missing company profile without requiring a separate setup', async () => {
  let profileCreate;
  let socialCreate;
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        companyProfile: {
          upsert: async ({ create }) => {
            profileCreate = create;
            return create;
          },
        },
        socialLink: {
          ...createCmsPrisma().socialLink,
          create: async ({ data }) => {
            socialCreate = data;
            return { id: 'whatsapp-id', ...data };
          },
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/company-profile/social-links`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'WhatsApp', url: 'https://wa.me/255622923299' }),
    });
    assert.equal(response.status, 201);
  });
  assert.deepEqual(profileCreate, { id: 1, name: 'Ztalent Coder' });
  assert.deepEqual(socialCreate, {
    companyProfileId: 1,
    platform: 'whatsapp',
    url: 'https://wa.me/255622923299',
  });
});

test('social-link PATCH updates one field on the selected link only', async () => {
  let socialLink = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    companyProfileId: 1,
    platform: 'whatsapp',
    url: 'https://wa.me/255600000000',
    sortOrder: 2,
    isActive: true,
  };
  let updateOptions;
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        socialLink: {
          ...createCmsPrisma().socialLink,
          updateMany: async (options) => {
            updateOptions = options;
            socialLink = { ...socialLink, ...options.data };
            return { count: 1 };
          },
          findUnique: async () => socialLink,
        },
      },
    }),
    frontendOrigin: 'http://frontend.test',
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/company-profile/social-links/${socialLink.id}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://wa.me/255622923299' }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).item.url, 'https://wa.me/255622923299');
  });
  assert.deepEqual(updateOptions.where, { id: socialLink.id, companyProfileId: 1 });
  assert.deepEqual(updateOptions.data, { url: 'https://wa.me/255622923299' });
  assert.equal(socialLink.platform, 'whatsapp');
  assert.equal(socialLink.sortOrder, 2);
  assert.equal(socialLink.isActive, true);
});

test('team member CMS manages portfolio details without biography fields', async () => {
  let created;
  const app = cmsApp({
    overrides: {
      teamMember: {
        ...createCmsPrisma().teamMember,
        create: async ({ data }) => {
          created = data;
          return { id: 'team-id', ...data };
        },
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/team-members`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ada Example',
        role: 'Lead Engineer',
        photoUrl: 'https://images.example.test/ada.webp',
        portfolioUrl: 'https://ada.example.test',
        photoPosition: 45,
        status: 'PUBLISHED',
        sortOrder: 2,
      }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual((await response.json()).item, { id: 'team-id', ...created });

    const rejectedBiography = await fetch(`${baseUrl}/api/admin/team-members`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Member',
        role: 'Designer',
        bio: 'Biography is no longer managed here.',
        status: 'DRAFT',
      }),
    });
    assert.equal(rejectedBiography.status, 400);
    assert.equal((await rejectedBiography.json()).error.code, 'VALIDATION_ERROR');

    const missingPhoto = await fetch(`${baseUrl}/api/admin/team-members`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Photo', role: 'Contributor', status: 'PUBLISHED' }),
    });
    assert.equal(missingPhoto.status, 400);
    assert.equal((await missingPhoto.json()).error.code, 'VALIDATION_ERROR');

    const invalidPosition = await fetch(`${baseUrl}/api/admin/team-members`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Invalid Position', role: 'Contributor', photoPosition: 101, status: 'DRAFT' }),
    });
    assert.equal(invalidPosition.status, 400);
    assert.equal((await invalidPosition.json()).error.code, 'VALIDATION_ERROR');
  });
  assert.deepEqual(created, {
    name: 'Ada Example',
    role: 'Lead Engineer',
    photoUrl: 'https://images.example.test/ada.webp',
    portfolioUrl: 'https://ada.example.test',
    photoPosition: 45,
    status: 'PUBLISHED',
    sortOrder: 2,
  });
});

test('About page editor returns defaults and saves validated full content for editors', async () => {
  let upsertOptions;
  const content = structuredClone(DEFAULT_ABOUT_PAGE_CONTENT);
  const app = cmsApp({
    role: 'EDITOR',
    overrides: {
      aboutPageContent: {
        findUnique: async () => null,
        upsert: async (options) => {
          upsertOptions = options;
          return { content: options.create.content, updatedAt: new Date('2026-11-09T12:00:00Z') };
        },
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/api/admin/about-page`);
    assert.equal(unauthorized.status, 401);

    const load = await fetch(`${baseUrl}/api/admin/about-page`, { headers: adminHeaders() });
    assert.equal(load.status, 200);
    assert.deepEqual((await load.json()).item.content, DEFAULT_ABOUT_PAGE_CONTENT);

    content.whoWeAre.title = 'Updated identity';
    content.story.body = 'Updated story';
    content.missionVision.missionDescription = 'Updated mission';
    content.coreValues.values[0].description = 'Updated value';
    content.philosophy.principles[0].description = 'Updated philosophy';
    content.team.buttonLabel = 'Explore the team';
    content.closing.finalStatement = 'Updated closing';
    content.coreValues.values[0].isActive = false;
    content.coreValues.values[1].sortOrder = 0;
    content.team.destination = '/team';

    const save = await fetch(`${baseUrl}/api/admin/about-page`, {
      method: 'PUT',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    assert.equal(save.status, 200);
    assert.deepEqual((await save.json()).item.content, content);

    const invalid = await fetch(`${baseUrl}/api/admin/about-page`, {
      method: 'PUT',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { ...content, team: { ...content.team, destination: 'https://example.test' } } }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, 'VALIDATION_ERROR');
  });
  assert.deepEqual(upsertOptions.where, { id: 1 });
  assert.equal(upsertOptions.create.id, 1);
  assert.deepEqual(upsertOptions.create.content, content);
});
