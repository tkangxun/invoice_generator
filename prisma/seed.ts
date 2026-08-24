import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  // Alpha Vitality price list (from Assets/price_list.txt)
  const items: {
    name: string;
    priceCents: number;
    type: "service" | "supplement" | "package";
    aliases: string;
    includes?: string;
  }[] = [
    { name: "HBOT (Hyperbaric Oxygen Therapy)", priceCents: 26000, type: "service", aliases: "hbot, hyperbaric" },
    { name: "Red Light Therapy", priceCents: 11000, type: "service", aliases: "rlt, red light, redlight" },
    { name: "BIXEPS (PEMF)", priceCents: 6000, type: "service", aliases: "bixeps, bixep, pemf" },
    { name: "Personal Training", priceCents: 15000, type: "service", aliases: "personal training, pt" },
    { name: "Contrast Therapy", priceCents: 5000, type: "service", aliases: "contrast" },
    { name: "Vitality Assessment", priceCents: 12000, type: "service", aliases: "vitality assessment, assessment, inbody assessment" },
    { name: "Absolute Vitality (NMN)", priceCents: 38000, type: "supplement", aliases: "absolute vitality, nmn" },
    { name: "Asta80 (Astaxanthin)", priceCents: 25000, type: "supplement", aliases: "astaxanthin, asta80, asta" },
    { name: "Ultimate Probiotics", priceCents: 14000, type: "supplement", aliases: "ultimate probiotics, probiotics, probiotic, probio" },
    {
      name: "Vitality Experience",
      priceCents: 50000,
      type: "package",
      aliases: "vitality experience, vitality exp",
      includes:
        "1x HBOT (Hyperbaric Oxygen Therapy), 1x Red Light Therapy, 1x BIXEPS (PEMF), 1x Vitality Assessment",
    },
  ];

  // Replace the whole price list (safe: line items keep their own description/price copies)
  await prisma.item.deleteMany();
  for (const item of items) {
    await prisma.item.create({ data: item });
  }

  console.log(`Seed complete: ${users.length} users, ${items.length} items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
