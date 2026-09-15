import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import defaultItems from "./default-price-list.json";

const COMPANY_DEFAULTS = {
  brand: "Alpha Vitality",
  tagline: "Personalised Health Optimisation",
  legalName: "Alpha Sales & Marketing",
  uen: "202528313D",
  address: "1557 Keppel Road, #01-01, Singapore\n089066",
  paymentTerms: "Due on receipt",
};

const DEFAULT_PAYMENT_METHODS = [
  "Cash",
  "PayNow",
  "Bank Transfer",
  "Credit Card",
  "Cheque",
];

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const adminName = process.env.ADMIN_NAME?.trim() || "Admin";

  const users =
    adminEmail && adminPassword.length >= 6
      ? [
          {
            email: adminEmail,
            name: adminName,
            role: "ADMIN",
            password: adminPassword,
          },
        ]
      : process.env.NODE_ENV === "production"
        ? []
        : [
            {
              email: "admin@example.com",
              name: "Admin",
              role: "ADMIN",
              password: "admin123",
            },
            {
              email: "alice@example.com",
              name: "Alice Tan",
              role: "SALES",
              password: "sales123",
            },
            {
              email: "ben@example.com",
              name: "Ben Lim",
              role: "SALES",
              password: "sales123",
            },
          ];

  if (users.length === 0) {
    console.log(
      "No users seeded. Set ADMIN_EMAIL and ADMIN_PASSWORD (min 6 chars) to create an admin."
    );
  }

  let company = await prisma.company.findFirst({ orderBy: { name: "asc" } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        code: "alpha-vitality",
        name: COMPANY_DEFAULTS.brand,
        ...COMPANY_DEFAULTS,
      },
    });
  }

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: await bcrypt.hash(u.password, 10),
      },
    });
    await prisma.companyMembership.upsert({
      where: {
        userId_companyId: { userId: user.id, companyId: company.id },
      },
      create: { userId: user.id, companyId: company.id },
      update: {},
    });
    if (u.role === "ADMIN") {
      const companies = await prisma.company.findMany({ select: { id: true } });
      for (const row of companies) {
        await prisma.companyMembership.upsert({
          where: {
            userId_companyId: { userId: user.id, companyId: row.id },
          },
          create: { userId: user.id, companyId: row.id },
          update: {},
        });
      }
    }
  }

  await prisma.item.deleteMany({ where: { companyId: company.id } });
  if (
    (await prisma.itemType.count({ where: { companyId: company.id } })) === 0
  ) {
    await prisma.itemType.createMany({
      data: [
        {
          name: "Service",
          slug: "service",
          tracksCollection: false,
          hasIncludes: false,
          unitPlural: "sessions",
          sortOrder: 0,
          companyId: company.id,
        },
        {
          name: "Supplement",
          slug: "supplement",
          tracksCollection: true,
          hasIncludes: false,
          unitPlural: "bottles",
          sortOrder: 1,
          companyId: company.id,
        },
        {
          name: "Package",
          slug: "package",
          tracksCollection: false,
          hasIncludes: true,
          unitPlural: "sessions",
          sortOrder: 2,
          companyId: company.id,
        },
      ],
    });
  }
  for (const [sortOrder, item] of defaultItems.entries()) {
    await prisma.item.create({
      data: { ...item, sortOrder, companyId: company.id },
    });
  }

  if (
    (await prisma.paymentMethod.count({ where: { companyId: company.id } })) ===
    0
  ) {
    await prisma.paymentMethod.createMany({
      data: DEFAULT_PAYMENT_METHODS.map((name, sortOrder) => ({
        name,
        sortOrder,
        companyId: company.id,
      })),
    });
  }

  console.log(
    `Seed complete: ${users.length} users, ${defaultItems.length} items, company ${company.code}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
