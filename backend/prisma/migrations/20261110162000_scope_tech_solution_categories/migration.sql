ALTER TABLE "business_areas"
ADD COLUMN "isTechSolution" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "business_areas" AS area
SET "isTechSolution" = TRUE
WHERE EXISTS (
    SELECT 1
    FROM "services" AS service
    WHERE service."businessAreaId" = area."id"
)
AND NOT EXISTS (
    SELECT 1
    FROM "projects" AS project
    WHERE project."businessAreaId" = area."id"
);

CREATE INDEX "business_areas_isTechSolution_sortOrder_idx"
ON "business_areas"("isTechSolution", "sortOrder");
