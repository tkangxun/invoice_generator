export type SupplementLine = {
  qty: number;
  collectedQty: number | null;
  description: string;
  item?: { type: string } | null;
};

export function isSupplementLine(
  line: { item?: { type: string } | null },
  collectionTypes?: Set<string>
): boolean {
  const slug = line.item?.type;
  if (!slug) return false;
  if (collectionTypes) return collectionTypes.has(slug);
  return slug === "supplement";
}

function unitPhrase(qty: number, unitPlural = "bottles"): string {
  const text = Number.isInteger(qty) ? String(qty) : String(qty);
  const singular = unitPlural.endsWith("s")
    ? unitPlural.slice(0, -1)
    : unitPlural;
  return qty === 1 ? `${text} ${singular}` : `${text} ${unitPlural}`;
}

export function supplementCollection(
  line: SupplementLine,
  collectionTypes?: Set<string>,
  unitPlural?: string
): {
  collected: number;
  credit: number;
  qty: number;
  unitPlural: string;
} | null {
  if (!isSupplementLine(line, collectionTypes)) return null;
  const collected = Math.min(
    line.qty,
    Math.max(0, line.collectedQty ?? line.qty)
  );
  const credit = Math.max(0, line.qty - collected);
  return {
    collected,
    credit,
    qty: line.qty,
    unitPlural: unitPlural ?? "bottles",
  };
}

export function supplementCollectionNote(
  line: SupplementLine,
  collectionTypes?: Set<string>,
  unitPlural?: string
): string | null {
  const info = supplementCollection(line, collectionTypes, unitPlural);
  if (!info || info.credit <= 0) return null;
  if (info.collected <= 0) return "Held as credit — not collected";
  return `Collected ${unitPhrase(info.collected, info.unitPlural)} · Credit ${unitPhrase(info.credit, info.unitPlural)}`;
}

export function supplementCreditSummary(
  lines: SupplementLine[],
  collectionTypes?: Set<string>,
  unitFor?: (slug: string) => string
): string[] {
  return lines.flatMap((line) => {
    const slug = line.item?.type ?? "";
    const info = supplementCollection(
      line,
      collectionTypes,
      unitFor?.(slug)
    );
    if (!info || info.credit <= 0) return [];
    return [
      `${line.description}: ${unitPhrase(info.credit, info.unitPlural)} on credit`,
    ];
  });
}
