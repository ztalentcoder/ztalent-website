CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "businessAreaId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "services"
ADD COLUMN "serviceCategoryId" UUID;

ALTER TABLE "business_areas"
ADD COLUMN "icon" VARCHAR(40) NOT NULL DEFAULT 'layers';

CREATE UNIQUE INDEX "service_categories_businessAreaId_slug_key"
ON "service_categories"("businessAreaId", "slug");

CREATE UNIQUE INDEX "service_categories_id_businessAreaId_key"
ON "service_categories"("id", "businessAreaId");

CREATE INDEX "service_categories_businessAreaId_status_sortOrder_idx"
ON "service_categories"("businessAreaId", "status", "sortOrder");

CREATE INDEX "services_serviceCategoryId_status_sortOrder_idx"
ON "services"("serviceCategoryId", "status", "sortOrder");

ALTER TABLE "service_categories"
ADD CONSTRAINT "service_categories_businessAreaId_fkey"
FOREIGN KEY ("businessAreaId") REFERENCES "business_areas"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "services"
ADD CONSTRAINT "services_serviceCategoryId_businessAreaId_fkey"
FOREIGN KEY ("serviceCategoryId", "businessAreaId")
REFERENCES "service_categories"("id", "businessAreaId")
ON DELETE RESTRICT ON UPDATE CASCADE;
