export function normalizeCompanyCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function uniqueCompanyCode(
  prisma: {
    company: {
      findUnique: (args: {
        where: { code: string };
        select: { id: true };
      }) => Promise<{ id: string } | null>;
    };
  },
  requested: string,
  excludeId?: string
): Promise<string> {
  const base = normalizeCompanyCode(requested) || "company";
  const taken = async (code: string) => {
    const row = await prisma.company.findUnique({
      where: { code },
      select: { id: true },
    });
    return row && row.id !== excludeId;
  };
  if (!(await taken(base))) return base;
  let n = 2;
  while (await taken(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
