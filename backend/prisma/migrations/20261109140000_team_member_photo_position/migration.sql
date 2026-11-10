ALTER TABLE "team_members"
    ADD COLUMN "photoPosition" SMALLINT;

ALTER TABLE "team_members"
    ADD CONSTRAINT "team_members_photo_position_range"
    CHECK ("photoPosition" IS NULL OR "photoPosition" BETWEEN 0 AND 100);