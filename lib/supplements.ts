export type SupplementLine = {
  qty: number;
  collectedQty: number | null;
  description: string;
  item?: { type: string } | null;
};

export function isSupplementLine(line: {
  item?: { type: string } | null;
}): boolean {
  return line.item?.type === "supplement";
}

function bottlesLabel(qty: number): string {
  const text = Number.isInteger(qty) ? String(qty) : String(qty);
  return qty === 1 ? `${text} bottle` : `${text} bottles`;
}

export function supplementCollection(line: SupplementLine): {
  collected: number;
  credit: number;
  qty: number;
} | null {
  if (!isSupplementLine(line)) return null;
  const collected = Math.min(
    line.qty,
    Math.max(0, line.collectedQty ?? line.qty)
  );
  const credit = Math.max(0, line.qty - collected);
  return { collected, credit, qty: line.qty };
}

export function supplementCollectionNote(line: SupplementLine): string | null {
  const info = supplementCollection(line);
  if (!info || info.credit <= 0) return null;
  if (info.collected <= 0) return "Held as credit — not collected";
  return `Collected ${bottlesLabel(info.collected)} · Credit ${bottlesLabel(info.credit)}`;
}

export function supplementCreditSummary(lines: SupplementLine[]): string[] {
  return lines.flatMap((line) => {
    const info = supplementCollection(line);
    if (!info || info.credit <= 0) return [];
    return [`${line.description}: ${bottlesLabel(info.credit)} on credit`];
  });
}
