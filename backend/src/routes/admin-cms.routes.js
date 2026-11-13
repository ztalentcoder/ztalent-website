import { Router } from 'express';
import { requireAdminAuth } from '../middleware/require-admin-auth.js';
import { requireAdminRole } from '../middleware/require-admin-role.js';
import { HttpError } from '../utils/http-error.js';
import { DEFAULT_ABOUT_PAGE_CONTENT, validateAboutPageContent } from '../services/about-page-content.js';

const CONTENT_ROLES = ['SUPER_ADMIN', 'EDITOR'];
const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const MESSAGE_STATUSES = ['NEW', 'READ', 'REPLIED', 'ARCHIVED'];
const COURSE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const SERVICE_ICONS = [
  'code',
  'smartphone',
  'layers',
  'palette',
  'database',
  'plug',
  'brain',
  'workflow',
  'settings',
  'life-buoy',
  'chart-no-axes-combined',
  'layout-dashboard',
  'brain-circuit',
  'trending-up',
];
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
const projectRelationsInclude = {
  keyFeatures: { orderBy: { sortOrder: 'asc' } },
  galleryImages: { orderBy: { sortOrder: 'asc' } },
};

const resourceConfigs = {
  'business-areas': {
    model: 'businessArea',
    fields: {
      name: { type: 'string', required: true, max: 120 },
      slug: { type: 'slug', max: 150 },
      summary: { type: 'string', max: 300, nullable: true },
      description: { type: 'string', nullable: true },
      icon: { type: 'enum', values: SERVICE_ICONS },
      imageUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
      isTechSolution: { type: 'boolean' },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
    },
    search: ['name', 'slug', 'summary', 'description'],
    filters: {
      status: { field: 'status', values: CONTENT_STATUSES },
      techSolutions: { field: 'isTechSolution', type: 'boolean', excludeProjectsWhenTrue: true },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    listInclude: { _count: { select: { services: true, projects: true } } },
    createRecord: (request, data) => createUniqueSlugRecord(
      getPrisma(request),
      'businessArea',
      { ...data, description: data.description ?? '' },
      'name',
      150,
    ),
    updateRecord: (request, id, data) => updateUniqueSlugRecord(
      getPrisma(request),
      'businessArea',
      id,
      Object.hasOwn(data, 'description') ? { ...data, description: data.description ?? '' } : data,
      'name',
      150,
    ),
    validateCreate: (request, data) => {
      if (request.query.techSolutions === 'true' && data.isTechSolution !== true) {
        throw invalid('Tech Solutions categories must be marked for Tech Solutions.');
      }
    },
    validateUpdate: async (request, id, data) => {
      if (request.query.techSolutions !== 'true') return;
      const current = await getPrisma(request).businessArea.findUnique({
        where: { id },
        select: { isTechSolution: true, _count: { select: { projects: true } } },
      });
      if (!current?.isTechSolution || current._count.projects > 0 || data.isTechSolution === false) {
        throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
      }
    },
    validateScope: async (request, id) => {
      if (request.query.techSolutions !== 'true') return;
      const current = await getPrisma(request).businessArea.findUnique({
        where: { id },
        select: { isTechSolution: true, _count: { select: { projects: true } } },
      });
      if (!current?.isTechSolution || current._count.projects > 0) {
        throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
      }
    },
    validateDelete: async (request, id) => {
      if (request.query.techSolutions === 'true') {
        const category = await getPrisma(request).businessArea.findUnique({
          where: { id },
          select: { isTechSolution: true, _count: { select: { projects: true } } },
        });
        if (!category?.isTechSolution || category._count.projects > 0) {
          throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
        }
      }
      const prisma = getPrisma(request);
      const [serviceCount, projectCount] = await Promise.all([
        prisma.service.count({ where: { businessAreaId: id } }),
        prisma.project.count({ where: { businessAreaId: id } }),
      ]);
      if (serviceCount > 0 || projectCount > 0) {
        throw new HttpError(409, 'CATEGORY_IN_USE', 'Reassign or delete the services and projects in this category before deleting it.');
      }
    },
  },
  services: {
    model: 'service',
    fields: {
      businessAreaId: { type: 'uuid', required: true },
      serviceCategoryId: { type: 'uuid', nullable: true },
      title: { type: 'string', required: true, max: 160 },
      slug: { type: 'slug', max: 180 },
      summary: { type: 'string', required: true, max: 300 },
      description: { type: 'string' },
      icon: { type: 'enum', values: SERVICE_ICONS },
      keyFeatures: { type: 'stringArray', maxItems: 20, itemMax: 180 },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
      publishedAt: { type: 'date', nullable: true },
    },
    search: ['title', 'slug', 'summary', 'description'],
    filters: {
      status: { field: 'status', values: CONTENT_STATUSES },
      businessAreaId: { field: 'businessAreaId', type: 'uuid' },
      serviceCategoryId: { field: 'serviceCategoryId', type: 'uuid' },
      techSolutions: {
        relation: 'businessArea',
        relationField: 'isTechSolution',
        type: 'boolean',
        excludeProjectsWhenTrue: true,
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    listInclude: {
      businessArea: { select: { id: true, name: true, status: true } },
      serviceCategory: { select: { id: true, name: true, businessAreaId: true } },
    },
    createRecord: (request, data) => createUniqueSlugRecord(
      getPrisma(request),
      'service',
      {
        ...data,
        description: data.description ?? data.summary,
        icon: data.icon ?? 'code',
        keyFeatures: data.keyFeatures ?? [],
      },
      'title',
      180,
      'businessAreaId',
    ),
    validateCreate: async (request, data) => {
      if (request.query.businessAreaId !== undefined) {
        assertScopedServiceArea(request, data.businessAreaId);
      }
      if (request.query.techSolutions === 'true') {
        await validateTechSolutionCategory(request, data.businessAreaId);
      }
      await validateServiceCategoryAssignment(request, data);
    },
    validateUpdate: async (request, id, data) => {
      if (request.query.businessAreaId !== undefined) {
        assertScopedServiceArea(request, data.businessAreaId);
      }
      if (request.query.techSolutions === 'true') {
        const current = await getPrisma(request).service.findUnique({
          where: { id },
          select: { businessArea: { select: { isTechSolution: true, _count: { select: { projects: true } } } } },
        });
        if (!current?.businessArea?.isTechSolution || current.businessArea._count.projects > 0) {
          throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
        }
        if (data.businessAreaId) await validateTechSolutionCategory(request, data.businessAreaId);
      }
      await validateServiceCategoryAssignment(request, data, id);
    },
    validateScope: async (request, id) => {
      if (request.query.businessAreaId === undefined && request.query.techSolutions !== 'true') return;
      const current = await getPrisma(request).service.findUnique({
        where: { id },
        select: {
          businessAreaId: true,
          businessArea: { select: { isTechSolution: true, _count: { select: { projects: true } } } },
        },
      });
      if (!current) {
        throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
      }
      if (request.query.businessAreaId !== undefined) {
        assertScopedServiceArea(request, current.businessAreaId);
      }
      if (request.query.techSolutions === 'true'
        && (!current.businessArea?.isTechSolution || current.businessArea._count.projects > 0)) {
        throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
      }
    },
    updateRecord: (request, id, data) => updateUniqueSlugRecord(
      getPrisma(request),
      'service',
      id,
      data,
      'title',
      180,
      'businessAreaId',
    ),
  },
  'service-categories': {
    model: 'serviceCategory',
    fields: {
      businessAreaId: { type: 'uuid', required: true },
      name: { type: 'string', required: true, max: 120 },
      slug: { type: 'slug', max: 140 },
      description: { type: 'string', max: 500, nullable: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
    },
    search: ['name', 'slug', 'description'],
    filters: {
      status: { field: 'status', values: CONTENT_STATUSES },
      businessAreaId: { field: 'businessAreaId', type: 'uuid' },
    },
    orderBy: [{ businessAreaId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    listInclude: {
      businessArea: { select: { id: true, name: true } },
      _count: { select: { services: true } },
    },
    createRecord: (request, data) => createUniqueSlugRecord(
      getPrisma(request),
      'serviceCategory',
      data,
      'name',
      140,
      'businessAreaId',
    ),
    updateRecord: (request, id, data) => updateUniqueSlugRecord(
      getPrisma(request),
      'serviceCategory',
      id,
      data,
      'name',
      140,
      'businessAreaId',
    ),
    validateUpdate: async (request, id, data) => {
      if (!data.businessAreaId) return;
      const current = await getPrisma(request).serviceCategory.findUnique({
        where: { id },
        select: { businessAreaId: true, _count: { select: { services: true } } },
      });
      if (!current) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
      if (current.businessAreaId !== data.businessAreaId && current._count.services > 0) {
        throw new HttpError(409, 'CATEGORY_IN_USE', 'Reassign or delete the services in this category before changing its business area.');
      }
    },
    validateDelete: async (request, id) => {
      const serviceCount = await getPrisma(request).service.count({ where: { serviceCategoryId: id } });
      if (serviceCount > 0) {
        throw new HttpError(409, 'CATEGORY_IN_USE', 'Reassign or delete the services in this category before deleting it.');
      }
    },
  },
  projects: {
    model: 'project',
    fields: {
      businessAreaId: { type: 'uuid', nullable: true },
      title: { type: 'string', required: true, max: 180 },
      summary: { type: 'string', required: true, max: 400 },
      description: { type: 'string', required: true },
      imageUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
      problemStatement: { type: 'string', nullable: true },
      solution: { type: 'string', nullable: true },
      outcome: { type: 'string', nullable: true },
      liveUrl: { type: 'url', max: 2048, nullable: true },
      technologies: { type: 'stringArray', maxItems: 30, itemMax: 100 },
      keyFeatures: { type: 'projectFeatures', nullable: true },
      galleryImages: { type: 'projectGalleryImages', nullable: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
      publishedAt: { type: 'date', nullable: true },
    },
    createRecord: createProjectRecord,
    updateRecord: updateProjectRecord,
    listInclude: projectRelationsInclude,
    detailInclude: projectRelationsInclude,
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
      slug: { type: 'slug', max: 200 },
      summary: { type: 'string', max: 400, nullable: true },
      description: { type: 'string', required: true },
      imageUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
      level: { type: 'enum', values: COURSE_LEVELS, required: true },
      language: { type: 'string', max: 60, nullable: true },
      externalUrl: { type: 'youtube', max: 2048, nullable: true },
      learningOutcomes: { type: 'stringArray', maxItems: 30, itemMax: 300 },
      requirements: { type: 'stringArray', maxItems: 30, itemMax: 300 },
      courseCategoryId: { type: 'uuid', required: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
      publishedAt: { type: 'date', nullable: true },
    },
    search: ['title', 'slug', 'summary', 'language'],
    filters: {
      status: { field: 'status', values: CONTENT_STATUSES },
      level: { field: 'level', values: COURSE_LEVELS },
      courseCategoryId: { field: 'courseCategoryId', type: 'uuid' },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    listInclude: {
      category: { select: { id: true, name: true, status: true } },
      _count: { select: { episodes: true } },
    },
    validateCreate: async (request, data) => {
      await validateCourseCategory(request, data.courseCategoryId, data.status);
    },
    validateUpdate: async (request, id, data) => {
      const current = await getPrisma(request).academicCourse.findUnique({
        where: { id },
        select: { courseCategoryId: true, status: true },
      });
      if (!current) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
      const categoryId = data.courseCategoryId ?? current.courseCategoryId;
      const status = data.status ?? current.status;
      if (!categoryId) throw invalid('A course category is required.');
      await validateCourseCategory(request, categoryId, status);
    },
    createRecord: (request, data) => createCourseWithUniqueSlug(getPrisma(request), data),
    updateRecord: (request, id, data) => updateCourseWithUniqueSlug(getPrisma(request), id, data),
  },
  'course-categories': {
    model: 'courseCategory',
    fields: {
      name: { type: 'string', required: true, max: 120 },
      slug: { type: 'slug', required: true, max: 140 },
      description: { type: 'string', max: 500, nullable: true },
      imageUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
    },
    search: ['name', 'slug', 'description'],
    filters: { status: { field: 'status', values: CONTENT_STATUSES } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    listInclude: { _count: { select: { courses: true } } },
    validateDelete: async (request, id) => {
      const courseCount = await getPrisma(request).academicCourse.count({ where: { courseCategoryId: id } });
      if (courseCount > 0) {
        throw new HttpError(409, 'CATEGORY_IN_USE', 'Reassign or delete the courses in this category before deleting it.');
      }
    },
  },
  'blog-categories': {
    model: 'blogCategory',
    fields: {
      name: { type: 'string', required: true, max: 100 },
      slug: { type: 'slug', required: true, max: 120 },
      description: { type: 'string', max: 300, nullable: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
    },
    search: ['name', 'slug', 'description'],
    filters: {},
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    listInclude: { _count: { select: { posts: true } } },
    validateCreate: (request, data) => validateBlogCategoryName(request, data),
    validateUpdate: (request, id, data) => validateBlogCategoryName(request, data, id),
    validateDelete: async (request, id) => {
      const postCount = await getPrisma(request).blogPost.count({ where: { categoryId: id } });
      if (postCount > 0) {
        throw new HttpError(409, 'CATEGORY_IN_USE', 'Reassign the blog posts in this category before deleting it.');
      }
    },
  },
  'blog-posts': {
    model: 'blogPost',
    fields: {
      categoryId: { type: 'uuid', required: true },
      title: { type: 'string', required: true, max: 200 },
      slug: { type: 'slug', max: 220, nullable: true },
      author: { type: 'string', max: 180, nullable: true },
      excerpt: { type: 'string', max: 500, nullable: true },
      body: { type: 'string', required: true },
      coverImageUrl: { type: 'url', max: 2048, nullable: true, managedImagePath: true },
      coverImageAlt: { type: 'string', max: 300, nullable: true },
      readingTimeMinutes: { type: 'integer', min: 1, max: 240, nullable: true },
      isFeatured: { type: 'boolean' },
      seoTitle: { type: 'string', max: 180, nullable: true },
      metaDescription: { type: 'string', max: 300, nullable: true },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      publishedAt: { type: 'date', nullable: true },
    },
    createRecord: createBlogPostRecord,
    listInclude: { category: { select: { name: true, slug: true } } },
    search: ['title', 'slug', 'excerpt', 'body', 'author'],
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
      photoPosition: { type: 'integer', nullable: true, min: 0, max: 100 },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
      sortOrder: { type: 'integer', min: 0 },
    },
    search: ['name', 'role'],
    filters: { status: { field: 'status', values: CONTENT_STATUSES } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    validateCreate: async (_request, data) => {
      if (data.status === 'PUBLISHED' && !data.photoUrl) {
        throw invalid('A profile photo is required before publishing a team member.');
      }
    },
    validateUpdate: async (request, id, data) => {
      const current = await getPrisma(request).teamMember.findUnique({
        where: { id },
        select: { status: true, photoUrl: true },
      });
      if (!current) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
      const nextStatus = data.status ?? current.status;
      const nextPhoto = Object.hasOwn(data, 'photoUrl') ? data.photoUrl : current.photoUrl;
      if (nextStatus === 'PUBLISHED' && !nextPhoto) {
        throw invalid('A profile photo is required before publishing a team member.');
      }
    },
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

function slugifyCourseTitle(title) {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
    .replace(/-+$/g, '');
  return slug || 'course';
}

function slugifyValue(value, maxLength, fallback) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug || fallback;
}

async function validateServiceCategoryAssignment(request, data, serviceId) {
  const prisma = getPrisma(request);
  const current = serviceId
    ? await prisma.service.findUnique({
      where: { id: serviceId },
      select: { businessAreaId: true, serviceCategoryId: true, status: true },
    })
    : null;
  if (serviceId && !current) {
    throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
  }

  const businessAreaId = Object.hasOwn(data, 'businessAreaId') ? data.businessAreaId : current?.businessAreaId;
  const categoryId = Object.hasOwn(data, 'serviceCategoryId') ? data.serviceCategoryId : current?.serviceCategoryId;
  const status = data.status ?? current?.status;
  if (!categoryId) return;

  const category = await prisma.serviceCategory.findUnique({
    where: { id: categoryId },
    select: { businessAreaId: true, status: true },
  });
  if (!category || category.businessAreaId !== businessAreaId) {
    throw invalid('Select a service category belonging to the selected business area.');
  }
  if (status === 'PUBLISHED' && category.status !== 'PUBLISHED') {
    throw invalid('A service can only be published in a published service category.');
  }
}

function uniqueSlugCandidate(base, suffix, maxLength) {
  if (suffix === 1) return base;
  const ending = `-${suffix}`;
  return `${base.slice(0, maxLength - ending.length).replace(/-+$/g, '')}${ending}`;
}

function scopedSlugWhere(scopeField, scopeValue, slug) {
  return scopeField
    ? { [`${scopeField}_slug`]: { [scopeField]: scopeValue, slug } }
    : { slug };
}

async function createUniqueSlugRecord(prisma, modelName, data, sourceField, maxLength, scopeField) {
  const model = prisma[modelName];
  const base = slugifyValue(data.slug || data[sourceField], maxLength, modelName === 'service' ? 'service' : 'business-area');
  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const slug = uniqueSlugCandidate(base, suffix, maxLength);
    const where = scopedSlugWhere(scopeField, data[scopeField], slug);
    const existing = await model.findUnique({ where, select: { id: true } });
    if (existing) continue;

    try {
      return await model.create({ data: { ...data, slug } });
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
      const conflictingRecord = await model.findUnique({ where, select: { id: true } });
      if (!conflictingRecord) throw error;
    }
  }
  throw new HttpError(409, 'SLUG_GENERATION_FAILED', 'A unique slug could not be generated.');
}

async function updateUniqueSlugRecord(prisma, modelName, id, data, sourceField, maxLength, scopeField) {
  const model = prisma[modelName];
  if (!Object.hasOwn(data, 'slug') && !Object.hasOwn(data, sourceField)) {
    return model.update({ where: { id }, data });
  }

  const current = await model.findUnique({
    where: { id },
    select: { id: true, [sourceField]: true, slug: true, ...(scopeField ? { [scopeField]: true } : {}) },
  });
  if (!current) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');

  const updateData = { ...data };
  const sourceChanged = typeof data[sourceField] === 'string' && data[sourceField] !== current[sourceField];
  const scopeChanged = scopeField && data[scopeField] && data[scopeField] !== current[scopeField];
  if (
    sourceChanged &&
    current.slug === slugifyValue(current[sourceField], maxLength, modelName === 'service' ? 'service' : 'business-area') &&
    (!Object.hasOwn(data, 'slug') || data.slug === current.slug)
  ) {
    updateData.slug = slugifyValue(data[sourceField], maxLength, modelName === 'service' ? 'service' : 'business-area');
  }
  if (scopeChanged && !Object.hasOwn(updateData, 'slug')) updateData.slug = current.slug;
  if (!Object.hasOwn(updateData, 'slug')) return model.update({ where: { id }, data: updateData });

  const scopeValue = updateData[scopeField] ?? current[scopeField];
  const base = slugifyValue(updateData.slug || updateData[sourceField] || current[sourceField], maxLength, modelName === 'service' ? 'service' : 'business-area');
  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const slug = uniqueSlugCandidate(base, suffix, maxLength);
    const where = scopedSlugWhere(scopeField, scopeValue, slug);
    const existing = await model.findUnique({ where, select: { id: true } });
    if (existing && existing.id !== id) continue;

    try {
      return await model.update({ where: { id }, data: { ...updateData, slug } });
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
      const conflictingRecord = await model.findUnique({ where, select: { id: true } });
      if (!conflictingRecord || conflictingRecord.id === id) throw error;
    }
  }
  throw new HttpError(409, 'SLUG_GENERATION_FAILED', 'A unique slug could not be generated.');
}

function courseSlugCandidate(base, suffix) {
  if (suffix === 1) return base;
  const ending = `-${suffix}`;
  return `${base.slice(0, 200 - ending.length).replace(/-+$/g, '')}${ending}`;
}

async function createCourseWithUniqueSlug(prisma, data) {
  const base = slugifyCourseTitle(data.slug || data.title);
  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const slug = courseSlugCandidate(base, suffix);
    const existing = await prisma.academicCourse.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) continue;

    try {
      return await prisma.academicCourse.create({ data: { ...data, slug } });
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
      const conflictingCourse = await prisma.academicCourse.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!conflictingCourse) throw error;
    }
  }
  throw new HttpError(409, 'SLUG_GENERATION_FAILED', 'A unique course slug could not be generated.');
}

async function updateCourseWithUniqueSlug(prisma, id, data) {
  const current = await prisma.academicCourse.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true },
  });
  if (!current) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');

  const updateData = { ...data };
  const titleChanged = typeof data.title === 'string' && data.title !== current.title;
  const existingSlugWasGenerated = typeof current.title === 'string'
    && current.slug === slugifyCourseTitle(current.title);
  if (
    titleChanged &&
    existingSlugWasGenerated &&
    (!Object.hasOwn(data, 'slug') || data.slug === current.slug)
  ) {
    updateData.slug = slugifyCourseTitle(data.title);
  }

  if (!Object.hasOwn(updateData, 'slug')) {
    return prisma.academicCourse.update({ where: { id }, data: updateData });
  }

  const base = slugifyCourseTitle(updateData.slug);
  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const slug = courseSlugCandidate(base, suffix);
    const existing = await prisma.academicCourse.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing && existing.id !== id) continue;

    try {
      return await prisma.academicCourse.update({
        where: { id },
        data: { ...updateData, slug },
      });
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
      const conflictingCourse = await prisma.academicCourse.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!conflictingCourse || conflictingCourse.id === id) throw error;
    }
  }
  throw new HttpError(409, 'SLUG_GENERATION_FAILED', 'A unique course slug could not be generated.');
}

function parseYouTubeUrl(value, max) {
  const url = cleanString(value, max);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw invalid('A valid YouTube video URL is required.');
  }
  const host = parsed.hostname.toLowerCase();
  const isShortUrl = host === 'youtu.be';
  const isYouTubeHost = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host);
  const hasVideo = isShortUrl
    ? parsed.pathname.split('/').filter(Boolean).length === 1
    : isYouTubeHost && (
      (parsed.pathname === '/watch' && Boolean(parsed.searchParams.get('v'))) ||
      /^\/(?:embed|shorts|live)\/[^/]+/.test(parsed.pathname)
    );
  if (parsed.protocol !== 'https:' || !hasVideo) {
    throw invalid('A valid HTTPS YouTube video URL is required.');
  }
  return url;
}

function parseField(value, spec) {
  if (value === null) {
    if (spec.nullable) return null;
    throw invalid('Null is not allowed for this field.');
  }

  if (spec.type === 'projectFeatures') {
    if (!Array.isArray(value) || value.length > 30) {
      throw invalid('Project features contain an invalid number of entries.');
    }
    return value.map((feature, sortOrder) => {
      if (!feature || typeof feature !== 'object' || Array.isArray(feature)
        || Object.keys(feature).some((key) => !['title', 'description'].includes(key))) {
        throw invalid('A project feature is invalid.');
      }
      const title = cleanString(feature.title, 180);
      const description = cleanString(feature.description, 500);
      if (!title || !description) throw invalid('Project features require a title and short description.');
      return { title, description, sortOrder };
    });
  }
  if (spec.type === 'projectGalleryImages') {
    if (!Array.isArray(value) || value.length > 20) {
      throw invalid('Project gallery images contain an invalid number of entries.');
    }
    return value.map((image, sortOrder) => {
      if (!image || typeof image !== 'object' || Array.isArray(image)
        || Object.keys(image).some((key) => key !== 'imageUrl')) {
        throw invalid('A project gallery image is invalid.');
      }
      const imageUrl = cleanString(image.imageUrl, 2048);
      if (!/^\/uploads\/images\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(imageUrl)) {
        throw invalid('Project gallery images must use managed project image paths.');
      }
      return { imageUrl, sortOrder };
    });
  }
  if (spec.type === 'string') return cleanString(value, spec.max);
  if (spec.type === 'stringArray') {
    if (!Array.isArray(value) || value.length > spec.maxItems) {
      throw invalid('List fields contain an invalid number of entries.');
    }
    return value.map((entry) => {
      const cleaned = cleanString(entry, spec.itemMax);
      if (!cleaned) throw invalid('List entries cannot be empty.');
      return cleaned;
    });
  }
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
    if (
      !Number.isSafeInteger(value)
      || (spec.min !== undefined && value < spec.min)
      || (spec.max !== undefined && value > spec.max)
    ) {
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
      /^\/uploads\/images\/(?:company|business-areas|projects|blog|team|courses|course-categories)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/.test(url)
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
  if (spec.type === 'youtube') return parseYouTubeUrl(value, spec.max);
  throw invalid();
}

async function validateCourseCategory(request, id, courseStatus) {
  const category = await getPrisma(request).courseCategory.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!category) throw invalid('Select an existing course category.');
  if (courseStatus === 'PUBLISHED' && category.status !== 'PUBLISHED') {
    throw invalid('A course can only be published in a published category.');
  }
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

function projectCreateData(data) {
  const { keyFeatures, galleryImages, ...fields } = data;
  return {
    ...fields,
    slug: slugifyValue(data.title, 200, 'project'),
    ...(keyFeatures?.length
      ? { keyFeatures: { create: keyFeatures.map(({ title, description }, sortOrder) => ({ title, description, sortOrder })) } }
      : {}),
    ...(galleryImages?.length
      ? { galleryImages: { create: galleryImages.map(({ imageUrl }, sortOrder) => ({ imageUrl, sortOrder })) } }
      : {}),
  };
}

function projectUpdateData(data) {
  const { keyFeatures, galleryImages, ...fields } = data;
  return {
    ...fields,
    ...(Object.hasOwn(data, 'keyFeatures')
      ? {
        keyFeatures: {
          deleteMany: {},
          create: (keyFeatures ?? []).map(({ title, description }, sortOrder) => ({ title, description, sortOrder })),
        },
      }
      : {}),
    ...(Object.hasOwn(data, 'galleryImages')
      ? {
        galleryImages: {
          deleteMany: {},
          create: (galleryImages ?? []).map(({ imageUrl }, sortOrder) => ({ imageUrl, sortOrder })),
        },
      }
      : {}),
  };
}

async function createProjectRecord(request, data) {
  const prisma = getPrisma(request);
  const item = await createUniqueSlugRecord(prisma, 'project', projectCreateData(data), 'title', 200);
  return prisma.project.findUnique({
    where: { id: item.id },
    include: projectRelationsInclude,
  });
}

async function createBlogPostRecord(request, data) {
  const prisma = getPrisma(request);
  const slug = data.slug || slugifyValue(data.title, 220, 'article');
  return createUniqueSlugRecord(prisma, 'blogPost', { ...data, slug }, 'title', 220);
}

async function validateBlogCategoryName(request, data, id) {
  const existing = await getPrisma(request).blogCategory.findFirst({
    where: {
      name: { equals: data.name, mode: 'insensitive' },
      ...(id ? { id: { not: id } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, 'DUPLICATE_CATEGORY', 'A category with this name already exists.');
  }
}

async function updateProjectRecord(request, id, data) {
  return getPrisma(request).project.update({
    where: { id },
    data: projectUpdateData(data),
    include: projectRelationsInclude,
  });
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
      const value = parseField(
        filter.type === 'boolean' ? query[key] === 'true' ? true : query[key] === 'false' ? false : query[key] : query[key],
        { type: filter.type },
      );
      if (filter.relation) {
        where[filter.relation] = {
          [filter.relationField]: value,
          ...(filter.excludeProjectsWhenTrue && value ? { projects: { none: {} } } : {}),
        };
      } else {
        where[filter.field] = value;
        if (filter.excludeProjectsWhenTrue && value) where.projects = { none: {} };
      }
    }
  }
  const search = query.search === undefined ? undefined : cleanString(query.search, 100);
  if (search) {
    where.OR = config.search.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } }));
  }
  return where;
}

async function validateTechSolutionCategory(request, id) {
  const category = await getPrisma(request).businessArea.findUnique({
    where: { id },
    select: { isTechSolution: true, _count: { select: { projects: true } } },
  });
  if (!category?.isTechSolution || category._count.projects > 0) {
    throw invalid('Select a category managed by Tech Solutions.');
  }
}

function assertScopedServiceArea(request, serviceBusinessAreaId) {
  const scopedBusinessAreaId = parseField(request.query.businessAreaId, { type: 'uuid' });
  if (serviceBusinessAreaId !== scopedBusinessAreaId) {
    throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
  }
}

function getScopedServiceBody(request) {
  if (request.query.businessAreaId === undefined) return request.body;
  const scopedBusinessAreaId = parseField(request.query.businessAreaId, { type: 'uuid' });
  const requestedBusinessAreaId = request.body?.businessAreaId;
  if (requestedBusinessAreaId !== undefined && requestedBusinessAreaId !== scopedBusinessAreaId) {
    throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
  }
  return { ...request.body, businessAreaId: scopedBusinessAreaId };
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
        ...(config.listInclude ? { include: config.listInclude } : {}),
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
    const body = config.model === 'service' ? getScopedServiceBody(request) : request.body;
    const data = parseBody(body, config.fields, { creating: true });
    if (config.validateCreate) await config.validateCreate(request, data);
    const item = config.createRecord
      ? await config.createRecord(request, data)
      : await modelFor(request).create({ data });
    sendItem(response, item, 201);
  });

  router.get(`${collectionPath}/:id`, async (request, response) => {
    validateId(request.params.id);
    if (config.validateScope) await config.validateScope(request, request.params.id);
    const item = await modelFor(request).findUnique({
      where: { id: request.params.id },
      ...(config.detailInclude ? { include: config.detailInclude } : {}),
    });
    if (!item) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
    sendItem(response, item);
  });

  const update = async (request, response) => {
    validateId(request.params.id);
    const body = config.model === 'service' ? getScopedServiceBody(request) : request.body;
    const data = parseBody(body, config.fields);
    if (config.validateScope) await config.validateScope(request, request.params.id);
    if (config.validateUpdate) await config.validateUpdate(request, request.params.id, data);
    const item = config.updateRecord
      ? await config.updateRecord(request, request.params.id, data)
      : await modelFor(request).update({ where: { id: request.params.id }, data });
    sendItem(response, item);
  };
  router.patch(`${collectionPath}/:id`, update);
  router.put(`${collectionPath}/:id`, update);

  router.delete(`${collectionPath}/:id`, async (request, response) => {
    if (config.allowDelete === false) {
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'This resource cannot be deleted.');
    }
    validateId(request.params.id);
    if (config.validateScope) await config.validateScope(request, request.params.id);
    if (config.validateDelete) await config.validateDelete(request, request.params.id);
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
  adminRouter.put('/company-profile', async (request, response) => {
    const prisma = getPrisma(request);
    const existing = await prisma.companyProfile.findUnique({ where: { id: 1 } });
    const data = parseBody(request.body, companyProfileFields, { creating: !existing });
    const item = await prisma.companyProfile.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
      include: { socialLinks: { orderBy: { sortOrder: 'asc' } } },
    });
    sendItem(response, item);
  });
  adminRouter.patch('/company-profile', async (request, response) => {
    const prisma = getPrisma(request);
    const data = parseBody(request.body, companyProfileFields, { requiredFields: false });
    const item = await prisma.companyProfile.upsert({
      where: { id: 1 },
      create: { id: 1, name: data.name ?? 'Ztalent Coder', ...data },
      update: data,
      include: { socialLinks: { orderBy: { sortOrder: 'asc' } } },
    });
    sendItem(response, item);
  });

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
    data.platform = data.platform.trim().toLowerCase();
    const prisma = getPrisma(request);
    const duplicate = await prisma.socialLink.findFirst({
      where: {
        companyProfileId: 1,
        platform: { equals: data.platform, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) throw new HttpError(409, 'DUPLICATE_SOCIAL_PLATFORM', 'A link for this social platform already exists.');
    await prisma.companyProfile.upsert({
      where: { id: 1 },
      create: { id: 1, name: 'Ztalent Coder' },
      update: {},
    });
    const item = await prisma.socialLink.create({ data: { ...data, companyProfileId: 1 } });
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
    const prisma = getPrisma(request);
    if (Object.hasOwn(data, 'platform')) {
      data.platform = data.platform.trim().toLowerCase();
      const duplicate = await prisma.socialLink.findFirst({
        where: {
          companyProfileId: 1,
          id: { not: request.params.id },
          platform: { equals: data.platform, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate) throw new HttpError(409, 'DUPLICATE_SOCIAL_PLATFORM', 'A link for this social platform already exists.');
    }
    const { count } = await prisma.socialLink.updateMany({
      where: { id: request.params.id, companyProfileId: 1 },
      data,
    });
    if (!count) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
    sendItem(response, await prisma.socialLink.findUnique({ where: { id: request.params.id } }));
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

  adminRouter.get('/academic-courses/:courseId/episodes', async (request, response) => {
    validateId(request.params.courseId);
    const page = parsePageValue(request.query.page, 1, 1_000_000);
    const pageSize = parsePageValue(request.query.pageSize, 50, 100);
    const prisma = getPrisma(request);
    const course = await prisma.academicCourse.findUnique({
      where: { id: request.params.courseId },
      select: { id: true },
    });
    if (!course) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested course was not found.');
    const where = { courseId: request.params.courseId };
    const [items, total] = await Promise.all([
      prisma.courseEpisode.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.courseEpisode.count({ where }),
    ]);
    response.json({
      status: 'success',
      items,
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    });
  });

  adminRouter.post('/academic-courses/:courseId/episodes', async (request, response) => {
    validateId(request.params.courseId);
    const prisma = getPrisma(request);
    const course = await prisma.academicCourse.findUnique({
      where: { id: request.params.courseId },
      select: { id: true },
    });
    if (!course) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested course was not found.');
    const data = parseBody(request.body, {
      title: { type: 'string', required: true, max: 180 },
      summary: { type: 'string', max: 500, nullable: true },
      youtubeUrl: { type: 'youtube', required: true, max: 2048 },
      sortOrder: { type: 'integer', min: 0 },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
    }, { creating: true });
    const item = await prisma.courseEpisode.create({
      data: { ...data, courseId: request.params.courseId },
    });
    sendItem(response, item, 201);
  });

  adminRouter.patch('/academic-courses/:courseId/episodes/reorder', async (request, response) => {
    validateId(request.params.courseId);
    const episodeIds = request.body?.episodeIds;
    if (
      !Array.isArray(episodeIds) ||
      episodeIds.length > 100 ||
      episodeIds.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id)) ||
      new Set(episodeIds).size !== episodeIds.length
    ) {
      throw invalid('Episode order must contain unique valid episode identifiers.');
    }

    const prisma = getPrisma(request);
    const course = await prisma.academicCourse.findUnique({
      where: { id: request.params.courseId },
      select: { id: true },
    });
    if (!course) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested course was not found.');
    const current = await prisma.courseEpisode.findMany({
      where: { courseId: request.params.courseId },
      select: { id: true },
    });
    if (
      current.length !== episodeIds.length ||
      current.some((episode) => !episodeIds.includes(episode.id))
    ) {
      throw invalid('Episode order must include every episode in this course exactly once.');
    }

    await prisma.$transaction(episodeIds.map((id, sortOrder) => prisma.courseEpisode.update({
      where: { id },
      data: { sortOrder },
    })));
    response.json({ status: 'success' });
  });

  const updateEpisode = async (request, response) => {
    validateId(request.params.courseId);
    validateId(request.params.episodeId);
    const prisma = getPrisma(request);
    const current = await prisma.courseEpisode.findFirst({
      where: { id: request.params.episodeId, courseId: request.params.courseId },
      select: { id: true },
    });
    if (!current) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested episode was not found.');
    const data = parseBody(request.body, {
      title: { type: 'string', required: true, max: 180 },
      summary: { type: 'string', max: 500, nullable: true },
      youtubeUrl: { type: 'youtube', required: true, max: 2048 },
      sortOrder: { type: 'integer', min: 0 },
      status: { type: 'enum', values: CONTENT_STATUSES, required: true },
    });
    const item = await prisma.courseEpisode.update({
      where: { id: request.params.episodeId },
      data,
    });
    sendItem(response, item);
  };
  adminRouter.put('/academic-courses/:courseId/episodes/:episodeId', updateEpisode);
  adminRouter.patch('/academic-courses/:courseId/episodes/:episodeId', updateEpisode);

  adminRouter.delete('/academic-courses/:courseId/episodes/:episodeId', async (request, response) => {
    validateId(request.params.courseId);
    validateId(request.params.episodeId);
    const prisma = getPrisma(request);
    const episode = await prisma.courseEpisode.findFirst({
      where: { id: request.params.episodeId, courseId: request.params.courseId },
      select: { id: true },
    });
    if (!episode) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested episode was not found.');
    await prisma.courseEpisode.delete({ where: { id: request.params.episodeId } });
    response.json({ status: 'success' });
  });

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
