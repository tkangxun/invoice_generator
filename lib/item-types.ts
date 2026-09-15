import { prisma } from "@/lib/db";

export type ItemTypeInfo = {
  id: string;
  name: string;
  slug: string;
  tracksCollection: boolean;
  hasIncludes: boolean;
  unitPlural: string;
  sortOrder: number;
};

export type ItemTypeBehavior = {
  typeName: string;
  tracksCollection: boolean;
  hasIncludes: boolean;
  unitPlural: string;
};

export const DEFAULT_ITEM_TYPES: Array<
  Omit<ItemTypeInfo, "id">
> = [
  {
    name: "Service",
    slug: "service",
    tracksCollection: false,
    hasIncludes: false,
    unitPlural: "sessions",
    sortOrder: 0,
  },
  {
    name: "Supplement",
    slug: "supplement",
    tracksCollection: true,
    hasIncludes: false,
    unitPlural: "bottles",
    sortOrder: 1,
  },
  {
    name: "Package",
    slug: "package",
    tracksCollection: false,
    hasIncludes: true,
    unitPlural: "sessions",
    sortOrder: 2,
  },
];

export function slugifyItemType(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "type"
  );
}

export function fallbackBehavior(slug: string): ItemTypeBehavior {
  const row = DEFAULT_ITEM_TYPES.find((type) => type.slug === slug);
  if (row) {
    return {
      typeName: row.name,
      tracksCollection: row.tracksCollection,
      hasIncludes: row.hasIncludes,
      unitPlural: row.unitPlural,
    };
  }
  return {
    typeName: slug || "Service",
    tracksCollection: slug === "supplement",
    hasIncludes: slug === "package",
    unitPlural: slug === "supplement" ? "bottles" : "sessions",
  };
}

export function behaviorFor(
  slug: string,
  types: ItemTypeInfo[]
): ItemTypeBehavior {
  const row = types.find((type) => type.slug === slug);
  if (!row) return fallbackBehavior(slug);
  return {
    typeName: row.name,
    tracksCollection: row.tracksCollection,
    hasIncludes: row.hasIncludes,
    unitPlural: row.unitPlural,
  };
}

export function decorateItems<T extends { type: string }>(
  items: T[],
  types: ItemTypeInfo[]
) {
  return items.map((item) => ({
    ...item,
    ...behaviorFor(item.type, types),
  }));
}

export function collectionSlugs(types: ItemTypeInfo[]): Set<string> {
  const slugs = new Set(
    types.filter((type) => type.tracksCollection).map((type) => type.slug)
  );
  if (types.length === 0) slugs.add("supplement");
  return slugs;
}

export function unitLabel(qty: number, unitPlural: string): string {
  const text = Number.isInteger(qty) ? String(qty) : String(qty);
  const singular = unitPlural.endsWith("s")
    ? unitPlural.slice(0, -1)
    : unitPlural;
  return qty === 1 ? `${text} ${singular}` : `${text} ${unitPlural}`;
}

export async function uniqueItemTypeSlug(
  companyId: string,
  name: string,
  excludeId?: string
) {
  const base = slugifyItemType(name);
  const existing = await prisma.itemType.findMany({
    where: { companyId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { slug: true },
  });
  const taken = new Set(existing.map((row) => row.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export async function uniqueItemTypeName(
  companyId: string,
  name: string,
  excludeId?: string
) {
  const trimmed = (name.trim() || "Type").slice(0, 40);
  const existing = await prisma.itemType.findMany({
    where: { companyId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { name: true },
  });
  const taken = new Set(existing.map((row) => row.name.toLowerCase()));
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  let n = 2;
  while (taken.has(`${trimmed} ${n}`.toLowerCase())) n += 1;
  return `${trimmed} ${n}`;
}

export async function listItemTypes(companyId: string): Promise<ItemTypeInfo[]> {
  return prisma.itemType.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      tracksCollection: true,
      hasIncludes: true,
      unitPlural: true,
      sortOrder: true,
    },
  });
}

export async function collectionCatalog(companyId: string) {
  const types = await listItemTypes(companyId);
  const slugs = collectionSlugs(types);
  return {
    slugs,
    unitFor: (slug: string) => behaviorFor(slug, types).unitPlural,
  };
}

export function defaultItemTypeData(companyId: string) {
  return DEFAULT_ITEM_TYPES.map((type) => ({ ...type, companyId }));
}
