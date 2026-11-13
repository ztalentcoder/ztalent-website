ALTER TABLE "blog_categories"
ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "blog_posts"
ADD COLUMN "coverImageAlt" VARCHAR(300),
ADD COLUMN "author" VARCHAR(180),
ADD COLUMN "readingTimeMinutes" INTEGER,
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "seoTitle" VARCHAR(180),
ADD COLUMN "metaDescription" VARCHAR(300);

CREATE INDEX "blog_categories_status_sortOrder_name_idx"
ON "blog_categories"("status", "sortOrder", "name");

CREATE INDEX "blog_posts_status_isFeatured_publishedAt_idx"
ON "blog_posts"("status", "isFeatured", "publishedAt");

WITH initial_categories(name, slug, description, sort_order) AS (
  VALUES
    ('Technology & Software Development', 'technology-software-development', 'Web, mobile, programming, software engineering, and emerging technologies.', 0),
    ('Data & Artificial Intelligence', 'data-artificial-intelligence', 'Data science and analytics, artificial intelligence, machine learning, and automation.', 1),
    ('Education & Tutorials', 'education-tutorials', 'Programming tutorials, technical learning guides, career development, and practical resources.', 2),
    ('Innovation & Business', 'innovation-business', 'Digital transformation, entrepreneurship, business innovation, and technology opportunities in Africa.', 3),
    ('Ztalent Coder Updates', 'ztalent-coder-updates', 'Company announcements, project updates, achievements, events, and organizational news.', 4)
)
INSERT INTO "blog_categories" (
  "id", "name", "slug", "description", "status", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), seed.name, seed.slug, seed.description, 'PUBLISHED', seed.sort_order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM initial_categories AS seed
WHERE NOT EXISTS (
  SELECT 1
  FROM "blog_categories" AS existing
  WHERE lower(existing."name") = lower(seed.name)
     OR lower(existing."slug") = lower(seed.slug)
);
