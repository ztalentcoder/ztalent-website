import { Router } from 'express';
import { HttpError } from '../utils/http-error.js';
import { DEFAULT_ABOUT_PAGE_CONTENT, serializePublicAboutPage } from '../services/about-page-content.js';

const MAX_PAGE = 1_000_000;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 12;
const SERVICE_ICONS = new Set([
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
]);

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

function parseOptionalSearch(query, name, maximum = 100) {
  const value = query[name];
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > maximum) throw badRequest(`The ${name} value is invalid.`);
  return value.trim();
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
    homeHeroImage1Url: profile.homeHeroImage1Url,
    homeHeroImage2Url: profile.homeHeroImage2Url,
    homeHeroImage3Url: profile.homeHeroImage3Url,
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
    icon: SERVICE_ICONS.has(service.icon) ? service.icon : 'code',
    keyFeatures: Array.isArray(service.keyFeatures) ? service.keyFeatures : [],
    businessArea: service.businessArea?.status === 'PUBLISHED'
      ? { slug: service.businessArea.slug, name: service.businessArea.name }
      : null,
    category: service.serviceCategory?.status === 'PUBLISHED'
      ? { slug: service.serviceCategory.slug, name: service.serviceCategory.name }
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

function serializeProjectDetails(project) {
  return {
    ...serializeProject(project),
    description: project.description,
    problemStatement: project.problemStatement,
    solution: project.solution,
    keyFeatures: (project.keyFeatures ?? []).map(({ title, description }) => ({ title, description })),
    technologies: project.technologies ?? [],
    outcome: project.outcome,
    galleryImages: (project.galleryImages ?? []).map(({ imageUrl }) => imageUrl),
    liveUrl: project.liveUrl,
  };
}

function serializeCourse(course, { includeEpisodes = false } = {}) {
  return {
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    description: course.description,
    imageUrl: course.imageUrl,
    level: course.level,
    language: course.language,
    learningOutcomes: course.learningOutcomes,
    requirements: course.requirements,
    externalUrl: course.externalUrl,
    category: course.category ? {
      slug: course.category.slug,
      name: course.category.name,
    } : null,
    episodeCount: course.episodes?.length ?? 0,
    ...(includeEpisodes ? { episodes: course.episodes?.map((episode, index) => ({
      number: index + 1,
      title: episode.title,
      summary: episode.summary,
      youtubeUrl: episode.youtubeUrl,
    })) ?? [] } : {}),
    publishedAt: course.publishedAt,
  };
}

function serializeCourseCategory(category) {
  return {
    slug: category.slug,
    name: category.name,
    description: category.description,
    imageUrl: category.imageUrl,
  };
}

function serializeBlogPost(post) {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    coverImageUrl: post.coverImageUrl,
    coverImageAlt: post.coverImageAlt,
    author: post.author,
    readingTimeMinutes: post.readingTimeMinutes ?? estimateReadingTime(post.body),
    seoTitle: post.seoTitle,
    metaDescription: post.metaDescription,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    category: { slug: post.category.slug, name: post.category.name },
  };
}

function estimateReadingTime(body) {
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

function parseBlogSearch(value) {
  if (typeof value !== 'string' || value.length > 100) throw badRequest();
  return value.trim();
}

const publicBlogPostSelect = {
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  coverImageUrl: true,
  coverImageAlt: true,
  author: true,
  readingTimeMinutes: true,
  seoTitle: true,
  metaDescription: true,
  publishedAt: true,
  updatedAt: true,
  category: { select: { slug: true, name: true } },
};

function serializeTeamMember(member) {
  return {
    name: member.name,
    role: member.role,
    photoUrl: member.photoUrl,
    portfolioUrl: member.portfolioUrl,
    photoPosition: member.photoPosition ?? 35,
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
    description: statistic.description,
    suffix: statistic.suffix,
  };
}

async function getPublicStatistics(prisma) {
  const [records, projects, academicCourses] = await Promise.all([
    prisma.siteStatistic.findMany({
      where: {
        isActive: true,
        key: { in: ['projects-delivered', 'academic-courses', 'institutions-served', 'students-reached'] },
      },
      select: { key: true, label: true, description: true, value: true, suffix: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    }),
    prisma.project.count({ where: { status: 'PUBLISHED' } }),
    prisma.academicCourse.count({
      where: { status: 'PUBLISHED', category: { status: 'PUBLISHED' } },
    }),
  ]);
  const counts = { 'projects-delivered': projects, 'academic-courses': academicCourses };

  return records.map((record) => ({
    ...record,
    value: Object.hasOwn(counts, record.key) ? counts[record.key] : record.value,
  }));
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

  router.get('/about-page', safely(async (request, response) => {
    const record = await request.app.locals.prisma.aboutPageContent.findUnique({
      where: { id: 1 },
      select: { content: true },
    });
    response.set('Cache-Control', 'no-store').json({
      status: 'success',
      item: serializePublicAboutPage(record?.content ?? DEFAULT_ABOUT_PAGE_CONTENT),
    });
  }));

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
        homeHeroImage1Url: true,
        homeHeroImage2Url: true,
        homeHeroImage3Url: true,
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
    const statistics = await getPublicStatistics(request.app.locals.prisma);

    response.set('Cache-Control', 'no-store').json({
      status: 'success',
      statistics: statistics.map(({ key, label, description, value }) => ({
        key,
        label,
        description,
        value,
      })),
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
      icon: true,
      keyFeatures: true,
      businessArea: { select: { slug: true, name: true, status: true } },
      serviceCategory: { select: { slug: true, name: true, status: true } },
    },
    serialize: serializeService,
    where: () => ({
      status: 'PUBLISHED',
      businessArea: { status: 'PUBLISHED' },
      OR: [{ serviceCategoryId: null }, { serviceCategory: { status: 'PUBLISHED' } }],
    }),
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
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
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
      problemStatement: true,
      solution: true,
      outcome: true,
      liveUrl: true,
      technologies: true,
      keyFeatures: {
        select: { title: true, description: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
      galleryImages: {
        select: { imageUrl: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    serialize: serializeProjectDetails,
    where: () => ({ status: 'PUBLISHED' }),
  });

  router.get('/course-categories', safely(async (request, response) => {
    const unknown = Object.keys(request.query).filter((key) => !['page', 'pageSize'].includes(key));
    if (unknown.length) throw badRequest();
    const { page, pageSize } = parsePage(request.query);
    const where = { status: 'PUBLISHED' };
    const prisma = request.app.locals.prisma;
    const [records, total] = await Promise.all([
      prisma.courseCategory.findMany({
        where,
        select: { slug: true, name: true, description: true, imageUrl: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.courseCategory.count({ where }),
    ]);
    collectionResponse(response, records.map(serializeCourseCategory), page, pageSize, total);
  }));

  router.get('/academic-courses', safely(async (request, response) => {
    const unknown = Object.keys(request.query).filter((key) => (
      !['page', 'pageSize', 'search', 'category', 'level', 'sort'].includes(key)
    ));
    if (unknown.length) throw badRequest();
    const { page, pageSize } = parsePage(request.query);
    const search = parseOptionalSearch(request.query, 'search');
    const category = request.query.category ? parseFilterSlug(request.query.category) : undefined;
    const level = parseOptionalFilter(request.query, 'level', ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
    const sort = parseOptionalFilter(request.query, 'sort', ['displayOrder', 'titleAsc', 'titleDesc', 'newest']) || 'displayOrder';
    const where = {
      status: 'PUBLISHED',
      category: { status: 'PUBLISHED', ...(category ? { slug: category } : {}) },
      ...(level ? { level } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    };
    const orderBy = {
      displayOrder: [{ sortOrder: 'asc' }, { title: 'asc' }],
      titleAsc: [{ title: 'asc' }],
      titleDesc: [{ title: 'desc' }],
      newest: [{ publishedAt: 'desc' }, { title: 'asc' }],
    }[sort];
    const prisma = request.app.locals.prisma;
    const [records, total] = await Promise.all([
      prisma.academicCourse.findMany({
        where,
        select: {
          slug: true,
          title: true,
          summary: true,
          description: true,
          imageUrl: true,
          level: true,
          language: true,
          learningOutcomes: true,
          requirements: true,
          externalUrl: true,
          publishedAt: true,
          category: { select: { slug: true, name: true } },
          episodes: {
            where: { status: 'PUBLISHED' },
            select: { id: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.academicCourse.count({ where }),
    ]);
    collectionResponse(response, records.map(serializeCourse), page, pageSize, total);
  }));

  router.get('/academic-courses/:slug', safely(async (request, response) => {
    const slug = parseSlug(request.params.slug);
    const item = await request.app.locals.prisma.academicCourse.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        category: { status: 'PUBLISHED' },
      },
      select: {
        slug: true,
        title: true,
        summary: true,
        description: true,
        imageUrl: true,
        level: true,
        language: true,
        learningOutcomes: true,
        requirements: true,
        externalUrl: true,
        publishedAt: true,
        category: { select: { slug: true, name: true } },
        episodes: {
          where: { status: 'PUBLISHED' },
          select: { title: true, summary: true, youtubeUrl: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!item) throw publicNotFound();
    response.json({ status: 'success', item: serializeCourse(item, { includeEpisodes: true }) });
  }));

  createListRoute(router, 'blog-categories', {
    modelName: 'blogCategory',
    select: {
      slug: true,
      name: true,
      description: true,
      _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
    },
    serialize: ({ slug, name, description, _count }) => ({
      slug,
      name,
      description,
      postCount: _count.posts,
    }),
    where: () => ({
      status: 'PUBLISHED',
      posts: { some: { status: 'PUBLISHED' } },
    }),
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  createListRoute(router, 'blog-posts', {
    modelName: 'blogPost',
    select: publicBlogPostSelect,
    serialize: serializeBlogPost,
    where: () => ({
      status: 'PUBLISHED',
      category: { status: 'PUBLISHED' },
    }),
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    allowedFilters: ['category', 'search'],
    filterWhere: (query) => {
      const filters = {};
      if (query.category) {
        filters.category = {
          slug: parseFilterSlug(query.category),
          status: 'PUBLISHED',
        };
      }
      if (query.search !== undefined) {
        const search = parseBlogSearch(query.search);
        if (search) {
          filters.OR = ['title', 'excerpt', 'body'].map((field) => ({
            [field]: { contains: search, mode: 'insensitive' },
          }));
        }
      }
      return filters;
    },
  });
  router.get('/blog-posts/:slug', safely(async (request, response) => {
    const slug = parseSlug(request.params.slug);
    const prisma = request.app.locals.prisma;
    const post = await prisma.blogPost.findFirst({
      where: {
        status: 'PUBLISHED',
        category: { status: 'PUBLISHED' },
        slug,
      },
      select: { ...publicBlogPostSelect, categoryId: true },
    });
    if (!post) throw publicNotFound();

    const relatedPosts = await prisma.blogPost.findMany({
      where: {
        status: 'PUBLISHED',
        category: { status: 'PUBLISHED' },
        categoryId: post.categoryId,
        slug: { not: post.slug },
      },
      select: publicBlogPostSelect,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 3,
    });
    response.json({
      status: 'success',
      item: {
        ...serializeBlogPost(post),
        relatedPosts: relatedPosts.map(serializeBlogPost),
      },
    });
  }));

  createListRoute(router, 'team-members', {
    modelName: 'teamMember',
    select: { name: true, role: true, photoUrl: true, portfolioUrl: true, photoPosition: true },
    serialize: serializeTeamMember,
    where: () => ({ status: 'PUBLISHED', photoUrl: { not: null } }),
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

  router.get('/site-statistics', safely(async (request, response) => {
    const unknown = Object.keys(request.query).filter((key) => !['page', 'pageSize'].includes(key));
    if (unknown.length) throw badRequest();
    const { page, pageSize } = parsePage(request.query);
    const items = (await getPublicStatistics(request.app.locals.prisma)).map(serializeStatistic);
    collectionResponse(response, items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, items.length);
  }));

  return router;
}
