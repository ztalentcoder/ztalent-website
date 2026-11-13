ALTER TABLE "projects"
ADD COLUMN "problemStatement" TEXT,
ADD COLUMN "solution" TEXT,
ADD COLUMN "outcome" TEXT,
ADD COLUMN "liveUrl" VARCHAR(2048),
ADD COLUMN "technologies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "project_key_features" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_key_features_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_gallery_images" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "imageUrl" VARCHAR(2048) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_gallery_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_key_features_projectId_sortOrder_idx"
ON "project_key_features"("projectId", "sortOrder");

CREATE INDEX "project_gallery_images_projectId_sortOrder_idx"
ON "project_gallery_images"("projectId", "sortOrder");

ALTER TABLE "project_key_features"
ADD CONSTRAINT "project_key_features_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_gallery_images"
ADD CONSTRAINT "project_gallery_images_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
