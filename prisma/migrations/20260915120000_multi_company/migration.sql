-- Rename branding profiles into tenant companies (keep the same ids).
ALTER TABLE "CompanySettings" RENAME TO "Company";
ALTER INDEX "CompanySettings_pkey" RENAME TO "Company_pkey";
ALTER INDEX "CompanySettings_name_key" RENAME TO "Company_name_key";
DROP INDEX IF EXISTS "CompanySettings_active_idx";

ALTER TABLE "Company" ADD COLUMN "code" TEXT;

WITH numbered AS (
  SELECT
    id,
    lower(regexp_replace(regexp_replace(trim("name"), '[^A-Za-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) AS base
  FROM "Company"
),
unique_codes AS (
  SELECT
    id,
    CASE
      WHEN base = '' THEN 'company-' || substr(id, 1, 8)
      WHEN COUNT(*) OVER (PARTITION BY base) = 1 THEN base
      ELSE base || '-' || substr(id, 1, 6)
    END AS code
  FROM numbered
)
UPDATE "Company"
SET "code" = unique_codes.code
FROM unique_codes
WHERE "Company".id = unique_codes.id;

ALTER TABLE "Company" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

CREATE TABLE "_MainCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "_MainCompany_pkey" PRIMARY KEY ("id")
);

INSERT INTO "_MainCompany" ("id", "name")
SELECT id, name
FROM "Company"
WHERE "active" = true
ORDER BY name ASC
LIMIT 1;

INSERT INTO "_MainCompany" ("id", "name")
SELECT id, name
FROM "Company"
WHERE NOT EXISTS (SELECT 1 FROM "_MainCompany")
ORDER BY name ASC
LIMIT 1;

-- Invoice company (from profile), then drop the old FK.
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_profileId_fkey";
ALTER TABLE "Invoice" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "companyName" TEXT;

UPDATE "Invoice"
SET
  "companyId" = "profileId",
  "companyName" = COALESCE("profileName", "companyName");

UPDATE "Invoice"
SET
  "companyId" = main.id,
  "companyName" = COALESCE("Invoice"."companyName", main.name)
FROM "_MainCompany" AS main
WHERE "Invoice"."companyId" IS NULL
   OR NOT EXISTS (SELECT 1 FROM "Company" c WHERE c.id = "Invoice"."companyId");

ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "profileId";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "profileName";
DROP INDEX IF EXISTS "Invoice_profileId_idx";

-- Memberships: everyone on the former main company; admins on every company.
CREATE TABLE "CompanyMembership" (
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("userId","companyId")
);

INSERT INTO "CompanyMembership" ("userId", "companyId")
SELECT u.id, main.id
FROM "User" u
CROSS JOIN "_MainCompany" main
ON CONFLICT DO NOTHING;

INSERT INTO "CompanyMembership" ("userId", "companyId")
SELECT u.id, c.id
FROM "User" u
CROSS JOIN "Company" c
WHERE u.role = 'ADMIN'
ON CONFLICT DO NOTHING;

CREATE INDEX "CompanyMembership_companyId_idx" ON "CompanyMembership"("companyId");

ALTER TABLE "CompanyMembership"
ADD CONSTRAINT "CompanyMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyMembership"
ADD CONSTRAINT "CompanyMembership_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Company" DROP COLUMN IF EXISTS "active";

-- Price list: attach current items to the main company, clone for the rest.
ALTER TABLE "Item" DROP CONSTRAINT IF EXISTS "Item_sku_key";
DROP INDEX IF EXISTS "Item_sku_key";
ALTER TABLE "Item" ADD COLUMN "companyId" TEXT;

UPDATE "Item"
SET "companyId" = main.id
FROM "_MainCompany" AS main
WHERE "Item"."companyId" IS NULL;

INSERT INTO "Item" (
  "id", "sku", "name", "description", "priceCents", "type", "aliases",
  "includes", "active", "sortOrder", "createdAt", "companyId"
)
SELECT
  'clone_' || c.id || '_' || i.id,
  i."sku",
  i."name",
  i."description",
  i."priceCents",
  i."type",
  i."aliases",
  i."includes",
  i."active",
  i."sortOrder",
  i."createdAt",
  c.id
FROM "Item" i
CROSS JOIN "Company" c
CROSS JOIN "_MainCompany" main
WHERE i."companyId" = main.id
  AND c.id <> main.id;

ALTER TABLE "Item" ALTER COLUMN "companyId" SET NOT NULL;
CREATE UNIQUE INDEX "Item_companyId_sku_key" ON "Item"("companyId", "sku");
CREATE INDEX "Item_companyId_sortOrder_idx" ON "Item"("companyId", "sortOrder");

ALTER TABLE "Item"
ADD CONSTRAINT "Item_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment methods per company.
DROP INDEX IF EXISTS "PaymentMethod_name_key";
ALTER TABLE "PaymentMethod" ADD COLUMN "companyId" TEXT;

UPDATE "PaymentMethod"
SET "companyId" = main.id
FROM "_MainCompany" AS main
WHERE "PaymentMethod"."companyId" IS NULL;

INSERT INTO "PaymentMethod" ("id", "name", "active", "sortOrder", "companyId")
SELECT
  'clone_' || c.id || '_' || m.id,
  m."name",
  m."active",
  m."sortOrder",
  c.id
FROM "PaymentMethod" m
CROSS JOIN "Company" c
CROSS JOIN "_MainCompany" main
WHERE m."companyId" = main.id
  AND c.id <> main.id;

ALTER TABLE "PaymentMethod" ALTER COLUMN "companyId" SET NOT NULL;
CREATE UNIQUE INDEX "PaymentMethod_companyId_name_key" ON "PaymentMethod"("companyId", "name");
CREATE INDEX "PaymentMethod_companyId_sortOrder_idx" ON "PaymentMethod"("companyId", "sortOrder");

ALTER TABLE "PaymentMethod"
ADD CONSTRAINT "PaymentMethod_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Receipts belong to the invoice's company.
ALTER TABLE "Receipt" ADD COLUMN "companyId" TEXT;

UPDATE "Receipt" AS r
SET "companyId" = i."companyId"
FROM "Invoice" AS i
WHERE r."invoiceId" = i.id;

UPDATE "Receipt"
SET "companyId" = main.id
FROM "_MainCompany" AS main
WHERE "Receipt"."companyId" IS NULL
   OR NOT EXISTS (SELECT 1 FROM "Company" c WHERE c.id = "Receipt"."companyId");

ALTER TABLE "Invoice" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Receipt" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_number_key";
DROP INDEX IF EXISTS "Invoice_number_key";
ALTER TABLE "Receipt" DROP CONSTRAINT IF EXISTS "Receipt_number_key";
DROP INDEX IF EXISTS "Receipt_number_key";

CREATE UNIQUE INDEX "Invoice_companyId_number_key" ON "Invoice"("companyId", "number");
CREATE INDEX "Invoice_companyId_issuedAt_idx" ON "Invoice"("companyId", "issuedAt");
CREATE UNIQUE INDEX "Receipt_companyId_number_key" ON "Receipt"("companyId", "number");
CREATE INDEX "Receipt_companyId_idx" ON "Receipt"("companyId");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receipt"
ADD CONSTRAINT "Receipt_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Counter" ("id", "value")
SELECT
  i."companyId" || ':INV-' || substring(i."number" from '^INV-([0-9]{4})'),
  MAX(CAST(substring(i."number" from '([0-9]+)$') AS INTEGER))
FROM "Invoice" i
WHERE i."number" ~ '^INV-[0-9]{4}-[0-9]+$'
GROUP BY i."companyId", substring(i."number" from '^INV-([0-9]{4})')
ON CONFLICT ("id") DO UPDATE SET "value" = GREATEST("Counter"."value", EXCLUDED."value");

INSERT INTO "Counter" ("id", "value")
SELECT
  r."companyId" || ':RCP-' || substring(r."number" from '^RCP-([0-9]{4})'),
  MAX(CAST(substring(r."number" from '([0-9]+)$') AS INTEGER))
FROM "Receipt" r
WHERE r."number" ~ '^RCP-[0-9]{4}-[0-9]+$'
GROUP BY r."companyId", substring(r."number" from '^RCP-([0-9]{4})')
ON CONFLICT ("id") DO UPDATE SET "value" = GREATEST("Counter"."value", EXCLUDED."value");

DROP TABLE "_MainCompany";
