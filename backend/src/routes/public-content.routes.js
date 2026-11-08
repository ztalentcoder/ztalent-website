import { Router } from 'express';
import { HttpError } from '../utils/http-error.js';

const MAX_PAGE = 1_000_000;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 12;

function badRequest(message = 'Request contains invalid query parameters.') {
  return new HttpError(400, 'VALIDATION_ERROR', message);
}

function parsePage(query) {
  const page = parseInteger(query.page, 1, MAX_PAGE);
  const pageSize = parseInteger(query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, pageSize };
}

function parseInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > maximum) {
    throw badRequest('Pagination values are invalid.');
  }
  return Number(value);
}

function parseOptionalFilter(query, name, values) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 120 || !values.includes(value)) {
    throw badRequest(`The ${name} filter is invalid.`);
  }
  return value;
}

function parseSlug(value) {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 220) {
    throw new HttpError(404, 'CONTENT_NOT_FOUND', 'The requested content was not found.');
  }
  return value;
}

function parseFilterSlug(value) {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 220) {
    throw badRequest('A slug filter is invalid.');
  }
  return value;
}

function publicError(error) {
  if (error instanceof HttpError) return error;
  return new HttpError(500, 'PUBLIC_CONTENT_UNAVAILABLE', 'Public content is temporarily unavailable.');
}

function safely(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response);
    } catch (error) {
      next(publicError(error));
    }
  };
}

function collectionResponse(response, items, page, pageSize, total) {
  response.json({
    status: 'success',
    items,
    pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
  });
}

function publicNotFound() {
  return new HttpError(404, 'CONTENT_NOT_FOUND', 'The requested content was not found.');
}

function serializeCompanyProfile(profile) {
  if (!profile) return null;
  return {
    name: profile.name,
    tagline: profile.tagline,
    description: profile.description,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    hours: profile.hours,
    logoUrl: profile.logoUrl,
    homeIntroImageUrl: profile.homeIntroImageUrl,
    socialLinks: (profile.socialLinks ?? []).map(({ platform, url }) => ({ platform, url })),
  };
}

function serializeBusinessArea(area) {
  return {
    slug: area.slug,
    name: area.name,
    summary: area.summary,
    description: area.description,
    imageUrl: area.imageUrl,
  };
}

function serializeService(service) {
  return {
    slug: service.slug,
    title: service.title,
    summary: service.summary,
    description: service.description,
    businessArea: service.businessArea?.status === 'PUBLISHED'
      ? { slug: service.businessArea.slug, name: service.businessArea.name }
      : null,
  };
}

function serializeProject(project) {
  return {
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    description: project.description,
    imageUrl: project.imageUrl,
    publishedAt: project.publishedAt,
    businessArea: project.businessArea?.status === 'PUBLISHED'
      ? { slug: project.businessArea.slug, name: project.businessArea.name }
      : null,
  };
}

function serializeCourse(course) {
  return {
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    level: course.level,
    language: course.language,
    episodeCount: course.episodeCount,
    externalUrl: course.externalUrl,
    publishedAt: course.publishedAt,
  };
}

function serializeBlogPost(post) {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    coverImageUrl: post.coverImageUrl,
    publishedAt: post.publishedAt,
    category: { slug: post.category.slug, name: post.category.name },
  };
}

function serializeTeamMember(member) {
  return {
    name: member.name,
    role: member.role,
    bio: member.bio,
    photoUrl: member.photoUrl,
  };
}

function serializeTestimonial(testimonial) {
  return {
    quote: testimonial.quote,
    attributionName: testimonial.attributionName,
    attributionOrganization: testimonial.attributionOrganization,
    project: testimonial.project?.status === 'PUBLISHED'
      ? { slug: testimonial.project.slug, title: testimonial.project.title }
      : null,
  };
}

function serializeStatistic(statistic) {
  return {
    key: statistic.key,
    label: statistic.label,
    value: statistic.value,
    suffix: statistic.suffix,
  };
}

function createListRoute(router, path, {
  modelName,
  select,
  serialize,
  where = () => ({}),
  orderBy,
  allowedFilters = [],
  filterWhere = () => ({}),
}) {
  router.get(`/${path}`, safely(async (request, response) => {
    const unknown = Object.keys(request.query).filter((key) => (
      !['page', 'pageSize', ...allowedFilters].includes(key)
    ));
    if (unknown.length) throw badRequest();
    const { page, pageSize } = parsePage(request.query);
    const filters = filterWhere(request.query);
    const criteria = { ...where(), ...filters };
    const prisma = request.app.locals.prisma;
    const [records, total] = await Promise.all([
      prisma[modelName].findMany({
        where: criteria,
        select,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma[modelName].count({ where: criteria }),
    ]);
    collectionResponse(response, records.map(serialize), page, pageSize, total);
  }));
}

function createDetailRoute(router, path, { modelName, select, serialize, where = () => ({}) }) {
  router.get(`/${path}/:slug`, safely(async (request, response) => {
    const slug = parseSlug(request.params.slug);
    const item = await request.app.locals.prisma[modelName].findFirst({
      where: { ...where(), slug },
      select,
    });
    if (!item) throw publicNotFound();
    response.json({ status: 'success', item: serialize(item) });
  }));
}

export function createPublicContentRouter() {
  const router = Router();

  router.get('/company-profile', safely(async (request, response) => {
    const profile = await request.app.locals.prisma.companyProfile.findUnique({
      where: { id: 1 },
      select: {
        name: true,
        tagline: true,
        description: true,
        email: true,
        phone: true,
        location: true,
        hours: true,
        logoUrl: true,
        homeIntroImageUrl: true,
        socialLinks: {
          where: { isActive: true },
          select: { platform: true, url: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    response.json({ status: 'success', item: serializeCompanyProfile(profile) });
  }));

  router.get('/statistics', safely(async (request, response) => {
    const prisma = request.app.locals.prisma;
    const [academicCourses, projects, services, blogArticles] = await Promise.all([
      prisma.academicCourse.count({ where: { status: 'PUBLISHED' } }),
      prisma.project.count({ where: { status: 'PUBLISHED' } }),
      prisma.service.count({
        where: { status: 'PUBLISHED', businessArea: { status: 'PUBLISHED' } },
      }),
      prisma.blogPost.count({ where: { status: 'PUBLISHED' } }),
    ]);
    const countStatistic = (key, value, singular, plural) => ({
      key,
      value,
      label: value === 1 ? singular : plural,
    });

    response.set('Cache-Control', 'no-store').json({
      status: 'success',
      statistics: [
        countStatistic('academicCourses', academicCourses, 'Academic Course', 'Academic Courses'),
        countStatistic('projects', projects, 'Published Project', 'Published Projects'),
        countStatistic('services', services, 'Service', 'Services'),
        countStatistic('blogArticles', blogArticles, 'Published Blog Article', 'Published Blog Articles'),
      ],
    });
  }));

  createListRoute(router, 'business-areas', {
    modelName: 'businessArea',
    select: { slug: true, name: true, summary: true, description: true, imageUrl: true },
    serialize: serializeBusinessArea,
    where: () => ({ status: 'PUBLISHED' }),
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  createDetailRoute(router, 'business-areas', {
    modelName: 'businessArea',
    select: { slug: true, name: true, summary: true, description: true, imageUrl: true },
    serialize: serializeBusinessArea,
    where: () => ({ status: 'PUBLISHED' }),
  });

  createListRoute(router, 'services', {
    modelName: 'service',
    select: {
      slug: true,
      title: true,
      summary: true,
      description: true,
      businessArea: { select: { slug: true, name: true, status: true } },
    },
    serialize: serializeService,
    where: () => ({ status: 'PUBLISHED', businessArea: { status: 'PUBLISHED' } }),
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    allowedFilters: ['businessArea'],
    filterWhere: (query) => query.businessArea
      ? { businessArea: { slug: parseFilterSlug(query.businessArea), status: 'PUBLISHED' } }
      : {},
  });

  createListRoute(router, 'projects', {
    modelName: 'project',
    select: {
      slug: true,
      title: true,
      summary: true,
      description: true,
      imageUrl: true,
      publishedAt: true,
      businessArea: { select: { slug: true, name: true, status: true } },
    },
    serialize: serializeProject,
    where: () => ({ status: 'PUBLISHED' }),
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    allowedFilters: ['businessArea'],
    filterWhere: (query) => query.businessArea
      ? { businessArea: { slug: parseFilterSlug(query.businessArea), status: 'PUBLISHED' } }
      : {},
  });
  createDetailRoute(router, 'projects', {
    modelName: 'project',
    select: {
      slug: true,
      title: true,
      summary: true,
      description: true,
      imageUrl: true,
      publishedAt: true,
      businessArea: { select: { slug: true, name: true, status: true } },
    },
    serialize: serializeProject,
    where: () => ({ status: 'PUBLISHED' }),
  });

  createListRoute(router, 'academic-courses', {
    modelName: 'academicCourse',
    select: {
      slug: true,
      title: true,
      summary: true,
      level: true,
      language: true,
      episodeCount: true,
      externalUrl: true,
      publishedAt: true,
    },
    serialize: serializeCourse,
    where: () => ({ status: 'PUBLISHED' }),
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    allowedFilters: ['level'],
    filterWhere: (query) => {
      const level = parseOptionalFilter(query, 'level', ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
      return level ? { level } : {};
    },
  });
  createDetailRoute(router, 'academic-courses', {
    modelName: 'academicCourse',
    select: {
      slug: true,
      title: true,
      summary: true,
      level: true,
      language: true,
      episodeCount: true,
      externalUrl: true,
      publishedAt: true,
    },
    serialize: serializeCourse,
    where: () => ({ status: 'PUBLISHED' }),
  });

  createListRoute(router, 'blog-categories', {
    modelName: 'blogCategory',
    select: { slug: true, name: true, description: true },
    serialize: ({ slug, name, description }) => ({ slug, name, description }),
    where: () => ({ posts: { some: { status: 'PUBLISHED' } } }),
    orderBy: { name: 'asc' },
  });
  createListRoute(router, 'blog-posts', {
    modelName: 'blogPost',
    select: {
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      coverImageUrl: true,
      publishedAt: true,
      category: { select: { slug: true, name: true } },
    },
    serialize: serializeBlogPost,
    where: () => ({ status: 'PUBLISHED' }),
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    allowedFilters: ['category'],
    filterWhere: (query) => query.category
      ? { category: { slug: parseFilterSlug(query.category), posts: { some: { status: 'PUBLISHED' } } } }
      : {},
  });
  createDetailRoute(router, 'blog-posts', {
    modelName: 'blogPost',
    select: {
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      coverImageUrl: true,
      publishedAt: true,
      category: { select: { slug: true, name: true } },
    },
    serialize: serializeBlogPost,
    where: () => ({ status: 'PUBLISHED' }),
  });

  createListRoute(router, 'team-members', {
    modelName: 'teamMember',
    select: { name: true, role: true, bio: true, photoUrl: true },
    serialize: serializeTeamMember,
    where: () => ({ status: 'PUBLISHED' }),
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  createListRoute(router, 'testimonials', {
    modelName: 'testimonial',
    select: {
      quote: true,
      attributionName: true,
      attributionOrganization: true,
      project: { select: { slug: true, title: true, status: true } },
    },
    serialize: serializeTestimonial,
    where: () => ({ status: 'PUBLISHED' }),
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  createListRoute(router, 'site-statistics', {
    modelName: 'siteStatistic',
    select: { key: true, label: true, value: true, suffix: true },
    serialize: serializeStatistic,
    where: () => ({ isActive: true }),
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });

  return router;
}
