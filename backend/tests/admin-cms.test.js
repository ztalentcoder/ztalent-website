import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from './helpers.js';
import { withServer } from './helpers.js';

const resourceModels = [
  'companyProfile',
  'socialLink',
  'businessArea',
  'service',
  'project',
  'academicCourse',
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

test('CMS mutations validate fields, normalize slugs, and return standard item responses', async () => {
  let created;
  let updated;
  const app = createApp({
    prismaClient: createCmsPrisma({
      overrides: {
        businessArea: {
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
    ['findUnique', { where: { id } }],
    ['update', { where: { id }, data: { status: 'ARCHIVED' } }],
    ['delete', { where: { id } }],
  ]);
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
        slug: 'research-service',
        description: 'Service description',
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
