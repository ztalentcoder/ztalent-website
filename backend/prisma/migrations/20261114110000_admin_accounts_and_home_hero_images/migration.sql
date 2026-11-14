ALTER TYPE "AdminRole" ADD VALUE 'ASSISTANT_ADMIN';

ALTER TABLE "company_profiles"
ADD COLUMN "homeHeroImage1Url" VARCHAR(2048),
ADD COLUMN "homeHeroImage2Url" VARCHAR(2048),
ADD COLUMN "homeHeroImage3Url" VARCHAR(2048);

ALTER TABLE "admin_users"
ADD COLUMN "username" VARCHAR(64);

ALTER TABLE "admin_users"
ALTER COLUMN "email" DROP NOT NULL;

WITH base_names AS (
    SELECT
        "id",
        CASE
            WHEN LENGTH(TRIM(BOTH '._-' FROM REGEXP_REPLACE(LOWER(SPLIT_PART("email", '@', 1)), '[^a-z0-9._-]+', '-', 'g'))) BETWEEN 3 AND 64
                THEN LEFT(TRIM(BOTH '._-' FROM REGEXP_REPLACE(LOWER(SPLIT_PART("email", '@', 1)), '[^a-z0-9._-]+', '-', 'g')), 64)
            ELSE 'admin-' || REPLACE("id"::TEXT, '-', '')
        END AS base_username
    FROM "admin_users"
),
resolved_names AS (
    SELECT
        candidate."id",
        candidate.base_username,
        COUNT(*) OVER (PARTITION BY candidate.base_username) AS duplicate_count,
        EXISTS (
            SELECT 1
            FROM base_names other
            WHERE other.base_username = 'admin-' || REPLACE(candidate."id"::TEXT, '-', '')
               OR 'admin-' || REPLACE(other."id"::TEXT, '-', '') = candidate.base_username
        ) AS fallback_collision
    FROM base_names candidate
)
UPDATE "admin_users" AS admin
SET "username" = CASE
    WHEN resolved.duplicate_count = 1 AND NOT resolved.fallback_collision
        THEN resolved.base_username
    ELSE 'admin-' || REPLACE(admin."id"::TEXT, '-', '')
END
FROM resolved_names resolved
WHERE admin."id" = resolved."id";

ALTER TABLE "admin_users"
ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

ALTER TABLE "admin_users"
ADD CONSTRAINT "admin_users_username_format_check"
CHECK ("username" = LOWER("username") AND "username" ~ '^[a-z0-9][a-z0-9._-]{2,63}$');

UPDATE "admin_users"
SET "role" = 'SUPER_ADMIN'
WHERE "id" = (
    SELECT "id"
    FROM "admin_users"
    ORDER BY "createdAt" ASC, "id" ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1
    FROM "admin_users"
    WHERE "role" = 'SUPER_ADMIN'
);
