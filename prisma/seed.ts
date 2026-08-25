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

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: await bcrypt.hash(u.password, 10),
      },
    });
  }

  // Replace the whole price list (safe: line items keep their own description/price copies)
  await prisma.item.deleteMany();
  for (const item of defaultItems) {
    await prisma.item.create({ data: item });
  }

  if ((await prisma.companySettings.count()) === 0) {
    await prisma.companySettings.create({
      data: {
        name: COMPANY_DEFAULTS.brand,
        active: true,
        ...COMPANY_DEFAULTS,
      },
    });
  }
  await prisma.paymentMethod.createMany({
    data: DEFAULT_PAYMENT_METHODS.map((name, sortOrder) => ({
      name,
      sortOrder,
    })),
    skipDuplicates: true,
  });

  console.log(
    `Seed complete: ${users.length} users, ${defaultItems.length} items, invoice settings.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
