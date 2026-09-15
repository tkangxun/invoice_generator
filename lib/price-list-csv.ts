import { dollarsToCents } from "@/lib/money";
import { parseCsv, toCsv } from "@/lib/csv";

export const PRICE_LIST_CSV_HEADERS = [
  "id",
  "name",
  "price",
  "type",
  "includes",
  "aliases",
  "description",
  "sku",
  "active",
] as const;

export const ITEM_TYPES = ["service", "supplement", "package"] as const;
export type ItemType = string;

export type PriceListCsvItem = {
  id: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  type: string;
  aliases: string | null;
  includes: string | null;
  active: boolean;
};

export type PriceListCsvRow = {
  line: number;
  item: PriceListCsvItem;
};

export type PriceListCsvColumn =
  | "id"
  | "sku"
  | "name"
  | "description"
  | "type"
  | "includes"
  | "aliases"
  | "active"
  | "price"
  | "priceCents";

const HEADER_ALIASES: Record<string, PriceListCsvColumn> = {
  id: "id",
  sku: "sku",
  name: "name",
  description: "description",
  type: "type",
  includes: "includes",
  aliases: "aliases",
  active: "active",
  enabled: "active",
  status: "active",
  price: "price",
  pricesgd: "price",
  prices: "price",
  pricecents: "priceCents",
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_$]+/g, "");
}

function blankToNull(value: string | undefined): string | null {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

export function parseItemType(value: string | undefined): string {
  const type = (value ?? "").trim().toLowerCase();
  return type || "service";
}

export function parseActiveFlag(value: string | undefined): boolean | null {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return null;
  if (["true", "yes", "y", "1", "active", "enabled"].includes(text)) return true;
  if (["false", "no", "n", "0", "inactive", "disabled"].includes(text)) {
    return false;
  }
  return null;
}

export function parsePriceCents(value: string): number | null {
  const cleaned = value
    .trim()
    .replace(/^(s\$|sgd|\$)/i, "")
    .replace(/,/g, "")
    .trim();
  if (!cleaned) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return dollarsToCents(amount);
}

export function priceListToCsv(
  items: Array<{
    id: string;
    sku: string | null;
    name: string;
    description: string | null;
    priceCents: number;
    type: string;
    aliases: string | null;
    includes: string | null;
    active: boolean;
  }>
): string {
  return toCsv(
    [...PRICE_LIST_CSV_HEADERS],
    items.map((item) => [
      item.id,
      item.name,
      (item.priceCents / 100).toFixed(2),
      item.type,
      item.includes,
      item.aliases,
      item.description,
      item.sku,
      item.active ? "true" : "false",
    ])
  );
}

export function parsePriceListCsv(text: string): {
  rows: PriceListCsvRow[];
  errors: string[];
  columns: Set<PriceListCsvColumn>;
} {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], errors: ["The CSV file is empty."], columns: new Set() };
  }

  const header = table[0].map(normalizeHeader);
  const index: Partial<Record<PriceListCsvColumn, number>> = {};
  header.forEach((key, i) => {
    const mapped = HEADER_ALIASES[key];
    if (mapped && index[mapped] == null) index[mapped] = i;
  });
  const columns = new Set(
    Object.keys(index).filter(Boolean) as PriceListCsvColumn[]
  );

  if (index.name == null) {
    return {
      rows: [],
      errors: ["The CSV needs a Name column."],
      columns,
    };
  }
  if (index.price == null && index.priceCents == null) {
    return {
      rows: [],
      errors: ["The CSV needs a Price column (S$)."],
      columns,
    };
  }

  const rows: PriceListCsvRow[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenSkus = new Set<string>();

  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const cell = (key: PriceListCsvColumn) => {
      const i = index[key];
      return i == null ? "" : (cells[i] ?? "");
    };

    const name = cell("name").trim();
    if (!name && cells.every((value) => !value.trim())) return;
    if (!name) {
      errors.push(`Row ${line}: name is required.`);
      return;
    }

    const type = parseItemType(cell("type"));

    const activeRaw = cell("active");
    const activeValue = parseActiveFlag(activeRaw);
    if (activeRaw.trim() && activeValue == null) {
      errors.push(`Row ${line}: active must be true or false.`);
      return;
    }

    const priceCents =
      index.price != null
        ? parsePriceCents(cell("price"))
        : (() => {
            const raw = cell("priceCents").trim();
            if (!raw) return null;
            const cents = Number(raw.replace(/,/g, ""));
            return Number.isInteger(cents) && cents >= 0 ? cents : null;
          })();
    if (priceCents == null) {
      errors.push(`Row ${line}: price must be a number in S$.`);
      return;
    }

    const id = blankToNull(cell("id"));
    const sku = blankToNull(cell("sku"));
    if (id) {
      if (seenIds.has(id)) {
        errors.push(`Row ${line}: duplicate id ${id}.`);
        return;
      }
      seenIds.add(id);
    }
    if (sku) {
      const skuKey = sku.toLowerCase();
      if (seenSkus.has(skuKey)) {
        errors.push(`Row ${line}: duplicate sku ${sku}.`);
        return;
      }
      seenSkus.add(skuKey);
    }

    rows.push({
      line,
      item: {
        id,
        sku,
        name,
        description: blankToNull(cell("description")),
        priceCents,
        type,
        aliases: blankToNull(cell("aliases")),
        includes: blankToNull(cell("includes")),
        active: activeValue ?? true,
      },
    });
  });

  return { rows, errors, columns };
}
