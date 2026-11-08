ALTER TABLE "site_statistics" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

INSERT INTO "site_statistics" ("id", "key", "label", "description", "value", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
    ('81000000-0000-4000-8000-000000000001', 'projects-delivered', 'Projects Delivered', 'Digital solutions built to address real-world challenges.', 0, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('81000000-0000-4000-8000-000000000002', 'academic-courses', 'Academic Courses', 'Learning opportunities available to develop technology skills.', 0, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('81000000-0000-4000-8000-000000000003', 'institutions-served', 'Institutions Served', 'Organizations supported through our technology solutions.', 0, 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('81000000-0000-4000-8000-000000000004', 'students-reached', 'Students Reached', 'Learners reached through our academic and training initiatives.', 0, 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
