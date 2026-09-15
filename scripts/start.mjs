import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import defaultItems from "../prisma/default-price-list.json" with { type: "json" };

const port = process.env.PORT || "3000";
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = port;

function databaseHost(url = "") {
  try {
    return new URL(url).host;
  } catch {
    const match = url.match(/@([^/]+)/);
    return match?.[1] ?? "";
  }
}

const dbUrl = process.env.DATABASE_URL ?? "";
const dbHost = databaseHost(dbUrl);
if (!dbUrl) {
  console.error(
    "DATABASE_URL is not set. On Railway, add it as a variable reference to Postgres.DATABASE_URL."
  );
  process.exit(1);
}
if (
  process.env.NODE_ENV === "production" &&
  (dbHost.startsWith("localhost") || dbHost.startsWith("127.0.0.1"))
) {
  console.error(
    `DATABASE_URL points at ${dbHost}, which is the local Docker database. In Railway Variables, set DATABASE_URL as a reference to the Postgres service (not the value from .env.example).`
  );
  process.exit(1);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function ensureDefaults() {
  const prisma = new PrismaClient();
  try {
    if ((await prisma.user.count()) === 0) {
      const email = (process.env.ADMIN_EMAIL || "admin@example.com")
        .trim()
        .toLowerCase();
      const password = process.env.ADMIN_PASSWORD || "admin123";
      const name = process.env.ADMIN_NAME?.trim() || "Admin";
      if (password.length < 6) {
        throw new Error("ADMIN_PASSWORD must be at least 6 characters.");
      }
      await prisma.user.create({
        data: {
          email,
          name,
          role: "ADMIN",
          passwordHash: await bcrypt.hash(password, 10),
        },
      });
      console.log(`Created default admin ${email}`);
    }
    let company = await prisma.company.findFirst({ orderBy: { name: "asc" } });
    if (!company) {
      company = await prisma.company.create({
        data: {
          code: "alpha-vitality",
          name: "Alpha Vitality",
          brand: "Alpha Vitality",
          tagline: "Personalised Health Optimisation",
          legalName: "Alpha Sales & Marketing",
          uen: "202528313D",
          address: "1557 Keppel Road, #01-01, Singapore\n089066",
          paymentTerms: "Due on receipt",
        },
      });
      console.log("Created default company alpha-vitality");
    }
    const orphanUsers = await prisma.user.findMany({
      where: { memberships: { none: {} } },
      select: { id: true, role: true },
    });
    if (orphanUsers.length) {
      const companies = await prisma.company.findMany({ select: { id: true } });
      for (const user of orphanUsers) {
        await prisma.companyMembership.create({
          data: { userId: user.id, companyId: company.id },
        });
        if (user.role === "ADMIN") {
          for (const row of companies) {
            if (row.id === company.id) continue;
            await prisma.companyMembership.create({
              data: { userId: user.id, companyId: row.id },
            });
          }
        }
      }
    }
    if ((await prisma.item.count()) === 0) {
      await prisma.item.createMany({
        data: defaultItems.map((item, sortOrder) => ({
          ...item,
          sortOrder,
          companyId: company.id,
        })),
      });
      console.log(`Created default price list (${defaultItems.length} items)`);
    }
    if (
      (await prisma.paymentMethod.count({ where: { companyId: company.id } })) ===
      0
    ) {
      await prisma.paymentMethod.createMany({
        data: [
          { name: "Cash", sortOrder: 0, companyId: company.id },
          { name: "PayNow", sortOrder: 1, companyId: company.id },
          { name: "Bank Transfer", sortOrder: 2, companyId: company.id },
          { name: "Credit Card", sortOrder: 3, companyId: company.id },
          { name: "Cheque", sortOrder: 4, companyId: company.id },
        ],
      });
      console.log("Created default payment methods");
    }
  } finally {
    await prisma.$disconnect();
  }
}

console.log(
  `Migrating database at ${dbHost || "unknown-host"}, then starting Next.js on 0.0.0.0:${port}`
);
await run("npx", ["prisma", "migrate", "deploy"]);
await ensureDefaults();
const server = spawn(
  "npx",
  ["next", "start", "--hostname", "0.0.0.0", "--port", port],
  { stdio: "inherit", shell: true, env: process.env }
);
server.on("exit", (code) => process.exit(code ?? 1));
