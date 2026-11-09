import { Router } from 'express';
import { requireAdminAuth } from '../middleware/require-admin-auth.js';
import { requireAdminRole } from '../middleware/require-admin-role.js';
import { HttpError } from '../utils/http-error.js';
import { DEFAULT_ABOUT_PAGE_CONTENT, validateAboutPageContent } from '../services/about-page-content.js';

const CONTENT_ROLES = ['SUPER_ADMIN', 'EDITOR'];
const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const MESSAGE_STATUSES = ['NEW', 'READ', 'REPLIED', 'ARCHIVED'];
const COURSE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const CONTACT_TOPICS = [
  'GENERAL_QUESTION',
  'REQUEST_SYSTEM',
  'REQUEST_DATA_SERVICE',
  'COURSE_QUESTION',
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SITE_STATISTIC_KEYS = [
  'projects-delivered',
  'academic-courses',
  'institutions-served',
  'students-reached',
];

const resourceConfigs = {
  'business-areas': {
    model: 'businessArea',
    fields: {
      name: { type: 'string', required: true, max: 120 },
      slug: { type: 'slug', required: true, max: 150 },
      summary: { type: 'string', max: 300, nullable: true },
      description: { type: 'string', required: true },
      imageUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
    },
    search: ['name', 'slug', 'summary', 'description'],
    filters: { status: { field: 'status', values: CONTENT_STATUSES } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  },
  services: {
    model: 'service',
    fields: {
      businessAreaId: { type: 'uuid', required: true },
      title: { type: 'string', required: true, max: 160 },
      slug: { type: 'slug', required: true, max: 180 },
      summary: { type: 'string', max: 300, nullable: true },
      description: { type: 'string', required: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
      publishedAt: { type: 'date', nullable: true },
    },
    search: ['title', 'slug', 'summary', 'description'],
    filters: {
      status: { field: 'status', values: CONTENT_STATUSES },
      businessAreaId: { field: 'businessAreaId', type: 'uuid' },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  },
  projects: {
    model: 'project',
    fields: {
      businessAreaId: { type: 'uuid', nullable: true },
      title: { type: 'string', required: true, max: 180 },
      slug: { type: 'slug', required: true, max: 200 },
      summary: { type: 'string', required: true, max: 400 },
      description: { type: 'string', required: true },
      imageUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
      publishedAt: { type: 'date', nullable: true },
    },
    search: ['title', 'slug', 'summary', 'description'],
    filters: {
      status: { field: 'status', values: CONTENT_STATUSES },
      businessAreaId: { field: 'businessAreaId', type: 'uuid' },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  },
  'academic-courses': {
    model: 'academicCourse',
    fields: {
      title: { type: 'string', required: true, max: 180 },
      slug: { type: 'slug', required: true, max: 200 },
      summary: { type: 'string', max: 400, nullable: true },
      level: { type: 'enum', values: COURSE_LEVELS, required: true },
      language: { type: 'string', max: 60, nullable: true },
      episodeCount: { type: 'integer', min: 0, nullable: true },
      externalUrl: { type: 'url', required: true, max: 2048 },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
      publishedAt: { type: 'date', nullable: true },
    },
    search: ['title', 'slug', 'summary', 'language'],
    filters: {
      status: { field: 'status', values: CONTENT_STATUSES },
      level: { field: 'level', values: COURSE_LEVELS },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  },
  'blog-categories': {
    model: 'blogCategory',
    fields: {
      name: { type: 'string', required: true, max: 100 },
      slug: { type: 'slug', required: true, max: 120 },
      description: { type: 'string', max: 300, nullable: true },
    },
    search: ['name', 'slug', 'description'],
    filters: {},
    orderBy: [{ name: 'asc' }],
  },
  'blog-posts': {
    model: 'blogPost',
    fields: {
      categoryId: { type: 'uuid', required: true },
      title: { type: 'string', required: true, max: 200 },
      slug: { type: 'slug', required: true, max: 220 },
      excerpt: { type: 'string', max: 500, nullable: true },
      body: { type: 'string', required: true },
      coverImageUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      publishedAt: { type: 'date', nullable: true },
    },
    search: ['title', 'slug', 'excerpt', 'body'],
    filters: {
      status: { field: 'status', values: CONTENT_STATUSES },
      categoryId: { field: 'categoryId', type: 'uuid' },
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  },
  'team-members': {
    model: 'teamMember',
    fields: {
      name: { type: 'string', required: true, max: 160 },
      role: { type: 'string', required: true, max: 120 },
      photoUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
      portfolioUrl: { type: 'url', max: 2048, nullable: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
    },
    search: ['name', 'role'],
    filters: { status: { field: 'status', values: CONTENT_STATUSES } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  },
  testimonials: {
    model: 'testimonial',
    fields: {
      projectId: { type: 'uuid', nullable: true },
      quote: { type: 'string', required: true },
      attributionName: { type: 'string', max: 160, nullable: true },
      attributionOrganization: { type: 'string', max: 180, nullable: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
    },
    search: ['quote', 'attributionName', 'attributionOrganization'],
    filters: {
      status: { field: 'status', values: CONTENT_STATUSES },
      projectId: { field: 'projectId', type: 'uuid' },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  },
  'site-statistics': {
    model: 'siteStatistic',
    fields: {
      label: { type: 'string', required: true, max: 120 },
      description: { type: 'string', required: true },
      value: { type: 'integer', required: true, min: 0 },
      sortOrder: { type: 'integer', min: 0 },
      isActive: { type: 'boolean' },
    },
    search: ['key', 'label', 'description'],
    filters: { isActive: { field: 'isActive', type: 'boolean' } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    baseWhere: { key: { in: SITE_STATISTIC_KEYS } },
    allowCreate: false,
    allowDelete: false,
    validateUpdate: async (request, id, data) => {
      const statistic = await getPrisma(request).siteStatistic.findUnique({
        where: { id },
        select: { key: true },
      });
      if (!statistic) {
        throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
      }
      if (!SITE_STATISTIC_KEYS.includes(statistic.key)) {
        throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
      }
      if (['projects-delivered', 'academic-courses'].includes(statistic.key) && Object.hasOwn(data, 'value')) {
        throw invalid('Automatically calculated statistic values cannot be changed.');
      }
    },
  },
};

const companyProfileFields = {
  name: { type: 'string', required: true, max: 120 },
  tagline: { type: 'string', max: 180, nullable: true },
  description: { type: 'string', nullable: true },
  email: { type: 'email', max: 320, nullable: true },
  phone: { type: 'string', max: 32, nullable: true },
  location: { type: 'string', max: 160, nullable: true },
  hours: { type: 'string', max: 160, nullable: true },
  logoUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
  homeIntroImageUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
};

const socialLinkFields = {
  platform: { type: 'string', required: true, max: 30 },
  url: { type: 'url', required: true, max: 2048 },
  sortOrder: { type: 'integer', min: 0 },
  isActive: { type: 'boolean' },
};

function invalid(message = 'Request contains invalid data.') {
  return new HttpError(400, 'VALIDATION_ERROR', message);
}

function cleanString(value, max) {
  if (typeof value !== 'string') throw invalid('Text fields must be strings.');
  const cleaned = value.replace(CONTROL_CHARACTERS, '').trim();
  if (max && cleaned.length > max) throw invalid(`Text fields must be at most ${max} characters.`);
  return cleaned;
}

function parseField(value, spec) {
  if (value === null) {
    if (spec.nullable) return null;
    throw invalid('Null is not allowed for this field.');
  }

  if (spec.type === 'string') return cleanString(value, spec.max);
  if (spec.type === 'slug') {
    const slug = cleanString(value, spec.max).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw invalid('Slugs may contain lowercase letters, numbers, and single hyphens only.');
    }
    return slug;
  }
  if (spec.type === 'enum') {
    if (!spec.values.includes(value)) throw invalid('An enum value is invalid.');
    return value;
  }
  if (spec.type === 'uuid') {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw invalid('A relation identifier is invalid.');
    return value;
  }
  if (spec.type === 'integer') {
    if (!Number.isSafeInteger(value) || (spec.min !== undefined && value < spec.min)) {
      throw invalid('Integer fields contain an invalid value.');
    }
    return value;
  }
  if (spec.type === 'boolean') {
    if (typeof value !== 'boolean') throw invalid('Boolean fields must be true or false.');
    return value;
  }
  if (spec.type === 'date') {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw invalid('A date field is invalid.');
    return new Date(value);
  }
  if (spec.type === 'email') {
    const email = cleanString(value, spec.max).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('An email address is invalid.');
    return email;
  }
  if (spec.type === 'url') {
    const url = cleanString(value, spec.max);
    if (
      spec.managedImagePath &&
      /^\/uploads\/images\/(?:company|business-areas|projects|blog|team)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/.test(url)
    ) return url;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw invalid('A URL field is invalid.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw invalid('Only HTTP and HTTPS URLs are allowed.');
    return url;
  }
  throw invalid();
}

function parseBody(body, fields, { creating = false, requiredFields = true } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('A JSON object is required.');
  const keys = Object.keys(body);
  const unknown = keys.filter((key) => !Object.hasOwn(fields, key));
  if (unknown.length) throw invalid('Request contains unsupported fields.');
  if (keys.length === 0) throw invalid('At least one field is required.');

  const data = {};
  for (const [key, spec] of Object.entries(fields)) {
    if (Object.hasOwn(body, key)) {
      data[key] = parseField(body[key], spec);
      if (spec.required && data[key] === '') throw invalid(`The ${key} field cannot be empty.`);
    }
    else if (creating && requiredFields && spec.required) throw invalid(`The ${key} field is required.`);
  }
  return data;
}

function parsePageValue(value, fallback, max) {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > max) throw invalid('Pagination values are invalid.');
  return Number(value);
}

function parseFilters(query, config) {
  const where = {};
  for (const [key, filter] of Object.entries(config.filters)) {
    if (query[key] === undefined) continue;
    if (filter.values) {
      if (!filter.values.includes(query[key])) throw invalid(`The ${key} filter is invalid.`);
      where[filter.field] = query[key];
    } else {
      where[filter.field] = parseField(
        filter.type === 'boolean' ? query[key] === 'true' ? true : query[key] === 'false' ? false : query[key] : query[key],
        { type: filter.type },
      );
    }
  }
  const search = query.search === undefined ? undefined : cleanString(query.search, 100);
  if (search) {
    where.OR = config.search.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } }));
  }
  return where;
}

function sendItem(response, item, status = 200) {
  response.status(status).json({ status: 'success', item });
}

function getPrisma(request) {
  return request.app.locals.prisma;
}

function validateId(id) {
  if (!UUID_PATTERN.test(id)) throw new HttpError(400, 'INVALID_ID', 'The resource identifier is invalid.');
}

function createResourceRoutes(router, path, config) {
  const modelFor = (request) => getPrisma(request)[config.model];
  const collectionPath = `/${path}`;

  router.get(collectionPath, async (request, response) => {
    const page = parsePageValue(request.query.page, 1, 1_000_000);
    const pageSize = parsePageValue(request.query.pageSize, 20, 100);
    const where = { ...parseFilters(request.query, config), ...config.baseWhere };
    const model = modelFor(request);
    const [items, total] = await Promise.all([
      model.findMany({
        where,
        orderBy: config.orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      model.count({ where }),
    ]);
    response.json({
      status: 'success',
      items,
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    });
  });

  router.post(collectionPath, async (request, response) => {
    if (config.allowCreate === false) {
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'This resource cannot be created.');
    }
    const data = parseBody(request.body, config.fields, { creating: true });
    const item = await modelFor(request).create({ data });
    sendItem(response, item, 201);
  });

  router.get(`${collectionPath}/:id`, async (request, response) => {
    validateId(request.params.id);
    const item = await modelFor(request).findUnique({ where: { id: request.params.id } });
    if (!item) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
    sendItem(response, item);
  });

  const update = async (request, response) => {
    validateId(request.params.id);
    const data = parseBody(request.body, config.fields);
    if (config.validateUpdate) await config.validateUpdate(request, request.params.id, data);
    const item = await modelFor(request).update({ where: { id: request.params.id }, data });
    sendItem(response, item);
  };
  router.patch(`${collectionPath}/:id`, update);
  router.put(`${collectionPath}/:id`, update);

  router.delete(`${collectionPath}/:id`, async (request, response) => {
    if (config.allowDelete === false) {
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'This resource cannot be deleted.');
    }
    validateId(request.params.id);
    await modelFor(request).delete({ where: { id: request.params.id } });
    response.json({ status: 'success' });
  });
}

function prismaErrorMapper(error, _request, _response, next) {
  if (error?.code === 'P2002') {
    next(new HttpError(409, 'DUPLICATE_RESOURCE', 'A resource with the same unique value already exists.'));
    return;
  }
  if (error?.code === 'P2003') {
    next(new HttpError(400, 'INVALID_RELATION', 'A related resource does not exist or cannot be changed.'));
    return;
  }
  if (error?.code === 'P2025') {
    next(new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.'));
    return;
  }
  next(error);
}

export function createAdminCmsRouter() {
  const adminRouter = Router();
  adminRouter.use(requireAdminAuth);
  adminRouter.use(requireAdminRole(...CONTENT_ROLES));

  adminRouter.get('/dashboard', async (request, response) => {
    const prisma = getPrisma(request);
    const modelNames = {
      businessAreas: 'businessArea',
      services: 'service',
      projects: 'project',
      blogPosts: 'blogPost',
      teamMembers: 'teamMember',
    };
    const entries = await Promise.all(
      Object.entries(modelNames).map(async ([name, model]) => [name, await prisma[model].count()]),
    );
    if (request.admin.role === 'SUPER_ADMIN') {
      entries.push([
        'newContactMessages',
        await prisma.contactMessage.count({ where: { status: 'NEW' } }),
      ]);
    }
    response.json({ status: 'success', counts: Object.fromEntries(entries) });
  });

  adminRouter.get('/company-profile', async (request, response) => {
    const item = await getPrisma(request).companyProfile.findUnique({
      where: { id: 1 },
      include: { socialLinks: { orderBy: { sortOrder: 'asc' } } },
    });
    sendItem(response, item);
  });
  const saveCompanyProfile = async (request, response) => {
    const existing = await getPrisma(request).companyProfile.findUnique({ where: { id: 1 } });
    const data = parseBody(request.body, companyProfileFields, { creating: !existing });
    const item = await getPrisma(request).companyProfile.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
      include: { socialLinks: { orderBy: { sortOrder: 'asc' } } },
    });
    sendItem(response, item);
  };
  adminRouter.put('/company-profile', saveCompanyProfile);
  adminRouter.patch('/company-profile', saveCompanyProfile);

  adminRouter.get('/about-page', async (request, response) => {
    const record = await getPrisma(request).aboutPageContent.findUnique({
      where: { id: 1 },
      select: { content: true, updatedAt: true },
    });
    sendItem(response, { content: record?.content ?? DEFAULT_ABOUT_PAGE_CONTENT, updatedAt: record?.updatedAt ?? null });
  });
  const saveAboutPage = async (request, response) => {
    const content = validateAboutPageContent(request.body?.content);
    const item = await getPrisma(request).aboutPageContent.upsert({
      where: { id: 1 },
      create: { id: 1, content },
      update: { content },
      select: { content: true, updatedAt: true },
    });
    sendItem(response, item);
  };
  adminRouter.put('/about-page', saveAboutPage);
  adminRouter.patch('/about-page', saveAboutPage);

  adminRouter.get('/company-profile/social-links', async (request, response) => {
    const page = parsePageValue(request.query.page, 1, 1_000_000);
    const pageSize = parsePageValue(request.query.pageSize, 20, 100);
    const where = { companyProfileId: 1 };
    if (request.query.isActive !== undefined) {
      where.isActive = parseField(
        request.query.isActive === 'true' ? true : request.query.isActive === 'false' ? false : request.query.isActive,
        { type: 'boolean' },
      );
    }
    if (request.query.search !== undefined) {
      const search = cleanString(request.query.search, 100);
      if (search) where.platform = { contains: search, mode: 'insensitive' };
    }
    const [items, total] = await Promise.all([
      getPrisma(request).socialLink.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      getPrisma(request).socialLink.count({ where }),
    ]);
    response.json({
      status: 'success',
      items,
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    });
  });
  adminRouter.post('/company-profile/social-links', async (request, response) => {
    const data = parseBody(request.body, socialLinkFields, { creating: true });
    const item = await getPrisma(request).socialLink.create({
      data: { ...data, companyProfileId: 1 },
    });
    sendItem(response, item, 201);
  });
  adminRouter.get('/company-profile/social-links/:id', async (request, response) => {
    validateId(request.params.id);
    const item = await getPrisma(request).socialLink.findFirst({
      where: { id: request.params.id, companyProfileId: 1 },
    });
    if (!item) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
    sendItem(response, item);
  });
  const updateSocialLink = async (request, response) => {
    validateId(request.params.id);
    const data = parseBody(request.body, socialLinkFields);
    const { count } = await getPrisma(request).socialLink.updateMany({
      where: { id: request.params.id, companyProfileId: 1 },
      data,
    });
    if (!count) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
    sendItem(response, await getPrisma(request).socialLink.findUnique({ where: { id: request.params.id } }));
  };
  adminRouter.patch('/company-profile/social-links/:id', updateSocialLink);
  adminRouter.put('/company-profile/social-links/:id', updateSocialLink);
  adminRouter.delete('/company-profile/social-links/:id', async (request, response) => {
    validateId(request.params.id);
    const { count } = await getPrisma(request).socialLink.deleteMany({
      where: { id: request.params.id, companyProfileId: 1 },
    });
    if (!count) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
    response.json({ status: 'success' });
  });

  for (const [path, config] of Object.entries(resourceConfigs)) {
    createResourceRoutes(adminRouter, path, config);
  }

  adminRouter.get('/contact-messages', requireAdminRole('SUPER_ADMIN'), async (request, response) => {
    const page = parsePageValue(request.query.page, 1, 1_000_000);
    const pageSize = parsePageValue(request.query.pageSize, 20, 100);
    const filters = {
      status: { field: 'status', values: MESSAGE_STATUSES },
      topic: { field: 'topic', values: CONTACT_TOPICS },
    };
    const where = {};
    for (const [key, filter] of Object.entries(filters)) {
      if (request.query[key] === undefined) continue;
      if (!filter.values.includes(request.query[key])) throw invalid(`The ${key} filter is invalid.`);
      where[filter.field] = request.query[key];
    }
    if (request.query.search !== undefined) {
      const search = cleanString(request.query.search, 100);
      if (search) {
        where.OR = ['name', 'email', 'phone', 'message'].map((field) => ({
          [field]: { contains: search, mode: 'insensitive' },
        }));
      }
    }
    const [items, total] = await Promise.all([
      getPrisma(request).contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      getPrisma(request).contactMessage.count({ where }),
    ]);
    response.json({
      status: 'success',
      items,
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    });
  });
  adminRouter.get('/contact-messages/:id', requireAdminRole('SUPER_ADMIN'), async (request, response) => {
    validateId(request.params.id);
    const item = await getPrisma(request).contactMessage.findUnique({ where: { id: request.params.id } });
    if (!item) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
    sendItem(response, item);
  });
  adminRouter.patch('/contact-messages/:id', requireAdminRole('SUPER_ADMIN'), async (request, response) => {
    validateId(request.params.id);
    const data = parseBody(request.body, {
      status: { type: 'enum', values: MESSAGE_STATUSES, required: true },
    });
    const item = await getPrisma(request).contactMessage.update({
      where: { id: request.params.id },
      data,
    });
    sendItem(response, item);
  });

  adminRouter.use(prismaErrorMapper);
  return adminRouter;
}
