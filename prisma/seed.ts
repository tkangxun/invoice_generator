import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import defaultItems from "./default-price-list.json";

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

  console.log(
    `Seed complete: ${users.length} users, ${defaultItems.length} items.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
