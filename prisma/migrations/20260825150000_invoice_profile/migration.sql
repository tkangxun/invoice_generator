-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "profileName" TEXT;

UPDATE "Invoice" AS i
SET
  "profileId" = p.id,
  "profileName" = p.name
FROM (
  SELECT id, name
  FROM "CompanySettings"
  WHERE active = true
  ORDER BY name ASC
  LIMIT 1
) AS p
WHERE i."profileId" IS NULL;

CREATE INDEX "Invoice_profileId_idx" ON "Invoice"("profileId");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "CompanySettings"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
