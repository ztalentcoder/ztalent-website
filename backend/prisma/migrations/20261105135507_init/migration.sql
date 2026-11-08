-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('NEW', 'READ', 'REPLIED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContactTopic" AS ENUM ('GENERAL_QUESTION', 'REQUEST_SYSTEM', 'REQUEST_DATA_SERVICE', 'COURSE_QUESTION');

-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'EDITOR');

-- CreateTable
CREATE TABLE "company_profiles" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "name" VARCHAR(120) NOT NULL,
    "tagline" VARCHAR(180),
    "description" TEXT,
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "location" VARCHAR(160),
    "hours" VARCHAR(160),
    "logoUrl" VARCHAR(2048),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_links" (
    "id" UUID NOT NULL,
    "companyProfileId" SMALLINT NOT NULL,
    "platform" VARCHAR(30) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_areas" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "summary" VARCHAR(300),
    "description" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "businessAreaId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "summary" VARCHAR(300),
    "description" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "businessAreaId" UUID,
    "title" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(400) NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" VARCHAR(2048),
    "status" "ContentStatus" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_courses" (
    "id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(400),
    "level" "CourseLevel" NOT NULL,
    "language" VARCHAR(60),
    "episodeCount" INTEGER,
    "externalUrl" VARCHAR(2048) NOT NULL,
    "status" "ContentStatus" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "academic_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "excerpt" VARCHAR(500),
    "body" TEXT NOT NULL,
    "coverImageUrl" VARCHAR(2048),
    "status" "ContentStatus" NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "role" VARCHAR(120) NOT NULL,
    "bio" TEXT,
    "photoUrl" VARCHAR(2048),
    "status" "ContentStatus" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phone" VARCHAR(32),
    "topic" "ContactTopic" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "quote" TEXT NOT NULL,
    "attributionName" VARCHAR(160),
    "attributionOrganization" VARCHAR(180),
    "status" "ContentStatus" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_statistics" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "value" INTEGER NOT NULL,
    "suffix" VARCHAR(20),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "role" "AdminRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3),
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_links_companyProfileId_sortOrder_idx" ON "social_links"("companyProfileId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "social_links_companyProfileId_platform_key" ON "social_links"("companyProfileId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "business_areas_slug_key" ON "business_areas"("slug");

-- CreateIndex
CREATE INDEX "business_areas_status_sortOrder_idx" ON "business_areas"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "services_businessAreaId_status_sortOrder_idx" ON "services"("businessAreaId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "services_businessAreaId_slug_key" ON "services"("businessAreaId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_status_publishedAt_idx" ON "projects"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "projects_businessAreaId_status_idx" ON "projects"("businessAreaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "academic_courses_slug_key" ON "academic_courses"("slug");

-- CreateIndex
CREATE INDEX "academic_courses_status_sortOrder_idx" ON "academic_courses"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_publishedAt_idx" ON "blog_posts"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "blog_posts_categoryId_status_idx" ON "blog_posts"("categoryId", "status");

-- CreateIndex
CREATE INDEX "team_members_status_sortOrder_idx" ON "team_members"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "contact_messages_status_createdAt_idx" ON "contact_messages"("status", "createdAt");

-- CreateIndex
CREATE INDEX "testimonials_status_sortOrder_idx" ON "testimonials"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "site_statistics_key_key" ON "site_statistics"("key");

-- CreateIndex
CREATE INDEX "site_statistics_isActive_sortOrder_idx" ON "site_statistics"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_tokenHash_key" ON "admin_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "admin_sessions_adminUserId_expiresAt_idx" ON "admin_sessions"("adminUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "admin_sessions_expiresAt_idx" ON "admin_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_businessAreaId_fkey" FOREIGN KEY ("businessAreaId") REFERENCES "business_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_businessAreaId_fkey" FOREIGN KEY ("businessAreaId") REFERENCES "business_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "blog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce the single-company-profile key.
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_id_singleton_check" CHECK ("id" = 1);

-- Require admin email addresses to be stored in normalized lowercase form.
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_email_lowercase_check" CHECK ("email" = LOWER("email"));
