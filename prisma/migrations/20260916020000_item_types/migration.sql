CREATE TABLE "ItemType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tracksCollection" BOOLEAN NOT NULL DEFAULT false,
    "hasIncludes" BOOLEAN NOT NULL DEFAULT false,
    "unitPlural" TEXT NOT NULL DEFAULT 'sessions',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ItemType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ItemType_companyId_slug_key" ON "ItemType"("companyId", "slug");
CREATE UNIQUE INDEX "ItemType_companyId_name_key" ON "ItemType"("companyId", "name");
CREATE INDEX "ItemType_companyId_sortOrder_idx" ON "ItemType"("companyId", "sortOrder");

ALTER TABLE "ItemType" ADD CONSTRAINT "ItemType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ItemType" ("id", "name", "slug", "tracksCollection", "hasIncludes", "unitPlural", "sortOrder", "companyId")
SELECT gen_random_uuid()::text, 'Service', 'service', false, false, 'sessions', 0, "id" FROM "Company";

INSERT INTO "ItemType" ("id", "name", "slug", "tracksCollection", "hasIncludes", "unitPlural", "sortOrder", "companyId")
SELECT gen_random_uuid()::text, 'Supplement', 'supplement', true, false, 'bottles', 1, "id" FROM "Company";

INSERT INTO "ItemType" ("id", "name", "slug", "tracksCollection", "hasIncludes", "unitPlural", "sortOrder", "companyId")
SELECT gen_random_uuid()::text, 'Package', 'package', false, true, 'sessions', 2, "id" FROM "Company";

INSERT INTO "ItemType" ("id", "name", "slug", "tracksCollection", "hasIncludes", "unitPlural", "sortOrder", "companyId")
SELECT
  gen_random_uuid()::text,
  initcap(replace(existing.type, '-', ' ')),
  existing.type,
  existing.type = 'supplement',
  existing.type = 'package',
  CASE WHEN existing.type = 'supplement' THEN 'bottles' ELSE 'sessions' END,
  10,
  existing."companyId"
FROM (
  SELECT DISTINCT "companyId", type FROM "Item"
  WHERE type <> '' AND type NOT IN ('service', 'supplement', 'package')
) AS existing
WHERE NOT EXISTS (
  SELECT 1 FROM "ItemType" t
  WHERE t."companyId" = existing."companyId" AND t.slug = existing.type
);
