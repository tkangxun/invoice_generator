-- AlterTable
ALTER TABLE "Item" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY "active" DESC, "type" ASC, "name" ASC, "id" ASC
    ) - 1 AS "sortOrder"
  FROM "Item"
)
UPDATE "Item"
SET "sortOrder" = ordered."sortOrder"
FROM ordered
WHERE "Item".id = ordered.id;
