CREATE TABLE "about_page_content" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "about_page_content_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "about_page_content"
    ADD CONSTRAINT "about_page_content_singleton_check" CHECK ("id" = 1);