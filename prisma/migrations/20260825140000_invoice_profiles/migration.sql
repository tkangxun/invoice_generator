-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN "name" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT false;

UPDATE "CompanySettings"
SET
  "name" = CASE
    WHEN coalesce(trim("brand"), '') = '' THEN 'Default'
    ELSE trim("brand")
  END,
  "active" = true
WHERE "name" IS NULL;

ALTER TABLE "CompanySettings" ALTER COLUMN "name" SET NOT NULL;

CREATE UNIQUE INDEX "CompanySettings_name_key" ON "CompanySettings"("name");
CREATE INDEX "CompanySettings_active_idx" ON "CompanySettings"("active");
