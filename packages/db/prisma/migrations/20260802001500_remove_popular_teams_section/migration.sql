-- Remove Favorite Fan Nations section from live homepage for all visitors
UPDATE "page_sections"
SET "visible" = false, "status" = 'INACTIVE'
WHERE "sectionKey" = 'popular-teams' AND "isHomepage" = true;

DELETE FROM "page_sections"
WHERE "sectionKey" = 'popular-teams' AND "isHomepage" = true;
