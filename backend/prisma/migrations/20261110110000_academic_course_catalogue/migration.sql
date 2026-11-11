CREATE TABLE "course_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500),
    "imageUrl" VARCHAR(2048),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_categories_slug_key" ON "course_categories"("slug");
CREATE INDEX "course_categories_status_sortOrder_idx" ON "course_categories"("status", "sortOrder");

ALTER TABLE "academic_courses"
    ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "imageUrl" VARCHAR(2048),
    ADD COLUMN "learningOutcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "requirements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "courseCategoryId" UUID;

ALTER TABLE "academic_courses"
    ALTER COLUMN "externalUrl" DROP NOT NULL;

ALTER TABLE "academic_courses"
    RENAME COLUMN "episodeCount" TO "legacyEpisodeCount";

CREATE INDEX "academic_courses_courseCategoryId_status_idx"
    ON "academic_courses"("courseCategoryId", "status");

ALTER TABLE "academic_courses"
    ADD CONSTRAINT "academic_courses_courseCategoryId_fkey"
    FOREIGN KEY ("courseCategoryId") REFERENCES "course_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "course_episodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "courseId" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "summary" VARCHAR(500),
    "youtubeUrl" VARCHAR(2048) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_episodes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "course_episodes_courseId_status_sortOrder_idx"
    ON "course_episodes"("courseId", "status", "sortOrder");

ALTER TABLE "course_episodes"
    ADD CONSTRAINT "course_episodes_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "academic_courses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "course_categories" ("name", "slug", "description", "status", "sortOrder")
VALUES
    ('Web Development', 'web-development', 'Build modern websites and web applications.', 'PUBLISHED', 0),
    ('Mobile Development', 'mobile-development', 'Create applications for mobile devices.', 'PUBLISHED', 1),
    ('Data Science', 'data-science', 'Explore data analysis, statistics, and practical data skills.', 'PUBLISHED', 2),
    ('Machine Learning', 'machine-learning', 'Learn machine learning concepts and applications.', 'PUBLISHED', 3)
ON CONFLICT ("slug") DO NOTHING;
