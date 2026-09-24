import { execSync } from "node:child_process";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createAccount } from "@/lib/account";

function databaseUrls() {
  const raw = fs.readFileSync(".env", "utf8");
  const line = raw.split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is missing from .env");
  let value = line.slice("DATABASE_URL=".length).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  const testUrl = new URL(value);
  testUrl.searchParams.set("schema", "account_test");
  return { appUrl: value, testUrl: testUrl.toString() };
}

const urls = databaseUrls();
const prisma = new PrismaClient({ datasourceUrl: urls.testUrl });
const account = createAccount(prisma);

beforeAll(async () => {
  const root = new PrismaClient({ datasourceUrl: urls.appUrl });
  await root.$executeRawUnsafe("CREATE SCHEMA IF NOT EXISTS account_test");
  await root.$disconnect();
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: urls.testUrl },
    stdio: "inherit",
  });
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.companyMembership.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.item.deleteMany();
  await prisma.itemType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
  await prisma.account.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function openOperator() {
  const opened = await account.openAccount({
    exempt: true,
    admin: { name: "Admin", email: "admin@example.com", password: "admin123" },
    company: { name: "Alpha Vitality", code: "alpha-vitality" },
  });
  if (!opened.ok) throw new Error(opened.error);
  return opened;
}

test("the operator account is exempt and its admin can sign in", async () => {
  const opened = await openOperator();

  expect(await account.exemption(opened.accountId)).toEqual({ exempt: true });
  expect(
    await account.signIn({
      companyCode: "alpha-vitality",
      email: "admin@example.com",
      password: "admin123",
    })
  ).toEqual({
    ok: true,
    userId: opened.userId,
    name: "Admin",
    role: "ADMIN",
    companyId: opened.companyId,
    access: "full",
  });
});

test("a disabled person cannot sign in", async () => {
  const opened = await openOperator();
  const sales = await account.addPerson(opened.userId, {
    name: "Alice Tan",
    email: "alice@example.com",
    password: "sales123",
    role: "SALES",
    companyId: opened.companyId,
  });
  if (!sales.ok) throw new Error(sales.error);

  expect(
    await account.signIn({
      companyCode: "alpha-vitality",
      email: "alice@example.com",
      password: "sales123",
    })
  ).toMatchObject({ ok: true, userId: sales.userId });

  expect(await account.setActive(opened.userId, sales.userId, false)).toEqual({
    ok: true,
  });
  expect(
    await account.signIn({
      companyCode: "alpha-vitality",
      email: "alice@example.com",
      password: "sales123",
    })
  ).toEqual({ ok: false, error: "invalid" });
});

test("wrong company, email, and password share one error", async () => {
  await openOperator();
  const wrong = { ok: false, error: "invalid" };

  expect(
    await account.signIn({
      companyCode: "missing-co",
      email: "admin@example.com",
      password: "admin123",
    })
  ).toEqual(wrong);
  expect(
    await account.signIn({
      companyCode: "alpha-vitality",
      email: "nobody@example.com",
      password: "admin123",
    })
  ).toEqual(wrong);
  expect(
    await account.signIn({
      companyCode: "alpha-vitality",
      email: "admin@example.com",
      password: "wrong-pass",
    })
  ).toEqual(wrong);
});

test("the same email can sign in to two accounts, chosen by company ID", async () => {
  const operator = await openOperator();
  const other = await account.openAccount({
    exempt: false,
    admin: { name: "Other Admin", email: "admin@example.com", password: "other-pass" },
    company: { name: "Alpha Vitality", code: "other-co" },
  });
  if (!other.ok) throw new Error(other.error);

  expect(await account.exemption(other.accountId)).toEqual({ exempt: false });
  const asOperator = await account.signIn({
    companyCode: "alpha-vitality",
    email: "Admin@Example.com",
    password: "admin123",
  });
  const asOther = await account.signIn({
    companyCode: "other-co",
    email: "admin@example.com",
    password: "other-pass",
  });
  expect(asOperator).toMatchObject({ ok: true, userId: operator.userId });
  expect(asOther).toMatchObject({ ok: true, userId: other.userId });
  expect(operator.userId).not.toBe(other.userId);
});

test("a taken company ID does not create a person", async () => {
  await openOperator();
  expect(
    await account.openAccount({
      exempt: false,
      admin: { name: "Second", email: "second@example.com", password: "second1" },
      company: { name: "Other Name", code: "alpha-vitality" },
    })
  ).toEqual({ ok: false, error: "company-id-taken" });
  expect(
    await account.signIn({
      companyCode: "alpha-vitality",
      email: "second@example.com",
      password: "second1",
    })
  ).toEqual({ ok: false, error: "invalid" });
});

test("an admin can add people with no seat limit, and the company list stays on the account", async () => {
  const opened = await openOperator();
  const other = await account.openAccount({
    exempt: false,
    admin: { name: "Other Admin", email: "other@example.com", password: "other-pass" },
    company: { name: "Climba Gyms", code: "climba-gyms" },
  });
  if (!other.ok) throw new Error(other.error);

  for (const name of ["Amy", "Ben", "Cara", "Dan", "Eve", "Fay"]) {
    const added = await account.addPerson(opened.userId, {
      name,
      email: `${name.toLowerCase()}@example.com`,
      password: "sales123",
      role: "SALES",
      companyId: opened.companyId,
    });
    expect(added.ok).toBe(true);
  }

  const created = await account.createCompany(opened.userId, {
    name: "Alpha Vitality",
    currentCompanyId: opened.companyId,
  });
  if (!created.ok) throw new Error(created.error);
  expect(created.name).toBe("Alpha Vitality 2");
  expect(created.code).toBe("alpha-vitality-2");

  expect(await account.companiesFor(opened.userId)).toEqual([
    { id: opened.companyId, name: "Alpha Vitality", code: "alpha-vitality" },
    { id: created.companyId, name: "Alpha Vitality 2", code: "alpha-vitality-2" },
  ]);
  expect(await account.companiesFor(other.userId)).toEqual([
    { id: other.companyId, name: "Climba Gyms", code: "climba-gyms" },
  ]);
});

test("an admin can belong to several companies and a salesperson cannot", async () => {
  const opened = await openOperator();
  const second = await account.createCompany(opened.userId, {
    name: "Event booth",
    currentCompanyId: opened.companyId,
  });
  if (!second.ok) throw new Error(second.error);

  const pat = await account.addPerson(opened.userId, {
    name: "Pat Admin",
    email: "pat@example.com",
    password: "admin123",
    role: "ADMIN",
    companyId: opened.companyId,
  });
  if (!pat.ok) throw new Error(pat.error);
  expect(
    await account.addPerson(opened.userId, {
      name: "Pat Admin",
      email: "pat@example.com",
      password: "admin123",
      role: "ADMIN",
      companyId: second.companyId,
    })
  ).toEqual({ ok: true, userId: pat.userId, created: false });
  expect(await account.companiesFor(pat.userId)).toEqual([
    { id: opened.companyId, name: "Alpha Vitality", code: "alpha-vitality" },
    { id: second.companyId, name: "Event booth", code: "event-booth" },
  ]);

  const alice = await account.addPerson(opened.userId, {
    name: "Alice Tan",
    email: "alice@example.com",
    password: "sales123",
    role: "SALES",
    companyId: opened.companyId,
  });
  if (!alice.ok) throw new Error(alice.error);
  expect(
    await account.addPerson(opened.userId, {
      name: "Alice Tan",
      email: "alice@example.com",
      password: "sales123",
      role: "SALES",
      companyId: second.companyId,
    })
  ).toEqual({ ok: false, error: "sales-other-company" });
  expect(await account.companiesFor(alice.userId)).toEqual([
    { id: opened.companyId, name: "Alpha Vitality", code: "alpha-vitality" },
  ]);
});

const newCustomer = {
  name: "New Admin",
  email: "new@example.com",
  password: "secret1",
  companyName: "New Co",
  companyCode: "new-co",
};

test("a taken company ID is refused before payment", async () => {
  await openOperator();
  let charged = false;
  const result = await account.signUp(
    { ...newCustomer, companyCode: "alpha-vitality" },
    {
      async chargeFirstPack() {
        charged = true;
        return { ok: true, customerId: "cus_should_not", subscriptionId: "sub_should_not" };
      },
      async renewalFailure() {
        return { ok: false };
      },
      async paymentSuccess() {
        return { ok: false };
      },
    }
  );
  expect(result).toEqual({ ok: false, error: "company-id-taken" });
  expect(charged).toBe(false);
});

test("a failed payment leaves no account, person, or company", async () => {
  const result = await account.signUp(
    { ...newCustomer, companyCode: "unpaid-co" },
    {
      async chargeFirstPack() {
        return { ok: false };
      },
      async renewalFailure() {
        return { ok: false };
      },
      async paymentSuccess() {
        return { ok: false };
      },
    }
  );
  expect(result).toEqual({ ok: false, error: "payment-failed" });
  expect(
    await account.signIn({
      companyCode: "alpha-vitality",
      email: "new@example.com",
      password: "secret1",
    })
  ).toEqual({ ok: false, error: "invalid" });
});

test("paying for the first pack creates the main admin with 4 seats left", async () => {
  const operator = await openOperator();
  let charged: unknown = null;
  const signedUp = await account.signUp(
    { ...newCustomer, email: "admin@example.com" },
    {
      async chargeFirstPack(input) {
        charged = input;
        return { ok: true, customerId: "cus_123", subscriptionId: "sub_123" };
      },
      async renewalFailure() {
        return { ok: false };
      },
      async paymentSuccess() {
        return { ok: false };
      },
    }
  );
  if (!signedUp.ok) throw new Error(signedUp.error);

  expect(charged).toEqual({
    email: "admin@example.com",
    packs: 1,
    interval: "month",
    currency: "SGD",
  });
  expect(await account.seats(signedUp.accountId)).toEqual({
    packs: 1,
    purchased: 5,
    used: 1,
    free: 4,
  });
  expect(await account.subscription(signedUp.accountId)).toEqual({
    quantity: 1,
    interval: "month",
    currency: "SGD",
  });
  expect(await account.person(signedUp.userId)).toEqual({
    isMainAdmin: true,
    role: "ADMIN",
    active: true,
  });
  expect(
    await account.signIn({
      companyCode: "new-co",
      email: "admin@example.com",
      password: "secret1",
    })
  ).toMatchObject({ ok: true, userId: signedUp.userId, companyId: signedUp.companyId });
  expect(await account.companiesFor(signedUp.userId)).toEqual([
    { id: signedUp.companyId, name: "New Co", code: "new-co" },
  ]);
  expect(await account.companiesFor(operator.userId)).toEqual([
    { id: operator.companyId, name: "Alpha Vitality", code: "alpha-vitality" },
  ]);
});

test("the same email cannot be a second person on one account", async () => {
  const opened = await openOperator();
  expect(
    await account.addPerson(opened.userId, {
      name: "Another Admin",
      email: "admin@example.com",
      password: "admin123",
      role: "SALES",
      companyId: opened.companyId,
    })
  ).toEqual({ ok: false, error: "email-exists" });
});

async function signUpCustomer(overrides: Partial<typeof newCustomer> = {}) {
  const input = { ...newCustomer, ...overrides };
  const signedUp = await account.signUp(input, {
    async chargeFirstPack() {
      return {
        ok: true,
        customerId: `cus_${input.companyCode}`,
        subscriptionId: `sub_${input.companyCode}`,
      };
    },
    async renewalFailure() {
      return { ok: false };
    },
    async paymentSuccess() {
      return { ok: false };
    },
  });
  if (!signedUp.ok) throw new Error(signedUp.error);
  return signedUp;
}

function paymentPort(options?: {
  failedAt?: Date;
  paymentOk?: boolean;
}) {
  return {
    async chargeFirstPack() {
      return { ok: false as const };
    },
    async renewalFailure() {
      if (!options?.failedAt) return { ok: false as const };
      return { ok: true as const, failedAt: options.failedAt };
    },
    async paymentSuccess() {
      if (options?.paymentOk === false) return { ok: false as const };
      return { ok: true as const };
    },
  };
}

async function fillRemainingSeats(
  adminUserId: string,
  companyId: string,
  count: number,
  prefix: string
) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const added = await account.addPerson(adminUserId, {
      name: `${prefix} ${i}`,
      email: `${prefix}${i}@example.com`,
      password: "sales123",
      role: "SALES",
      companyId,
    });
    if (!added.ok) throw new Error(added.error);
    ids.push(added.userId);
  }
  return ids;
}

test("each active person uses one seat, counted once across companies", async () => {
  const customer = await signUpCustomer();
  expect(await account.seats(customer.accountId)).toMatchObject({
    purchased: 5,
    used: 1,
    free: 4,
  });

  const second = await account.createCompany(customer.userId, {
    name: "Second Co",
    currentCompanyId: customer.companyId,
  });
  if (!second.ok) throw new Error(second.error);

  const pat = await account.addPerson(customer.userId, {
    name: "Pat Admin",
    email: "pat@example.com",
    password: "admin123",
    role: "ADMIN",
    companyId: customer.companyId,
  });
  if (!pat.ok) throw new Error(pat.error);
  expect(await account.seats(customer.accountId)).toMatchObject({ used: 2, free: 3 });

  expect(
    await account.addPerson(customer.userId, {
      name: "Pat Admin",
      email: "pat@example.com",
      password: "admin123",
      role: "ADMIN",
      companyId: second.companyId,
    })
  ).toEqual({ ok: true, userId: pat.userId, created: false });
  expect(await account.seats(customer.accountId)).toMatchObject({ used: 2, free: 3 });
});

test("adding a person is refused when seats are full", async () => {
  const customer = await signUpCustomer({ companyCode: "full-co", companyName: "Full Co" });
  await fillRemainingSeats(customer.userId, customer.companyId, 4, "seat");

  expect(await account.seats(customer.accountId)).toMatchObject({
    purchased: 5,
    used: 5,
    free: 0,
  });
  expect(
    await account.addPerson(customer.userId, {
      name: "Extra",
      email: "extra@example.com",
      password: "sales123",
      role: "SALES",
      companyId: customer.companyId,
    })
  ).toEqual({ ok: false, error: "seats-full" });
});

test("disabling frees a seat; re-enabling uses one and is refused when full", async () => {
  const customer = await signUpCustomer({
    companyCode: "toggle-co",
    companyName: "Toggle Co",
  });
  const [aliceId] = await fillRemainingSeats(
    customer.userId,
    customer.companyId,
    4,
    "toggle"
  );

  expect(await account.setActive(customer.userId, aliceId, false)).toEqual({ ok: true });
  expect(await account.seats(customer.accountId)).toMatchObject({ used: 4, free: 1 });
  expect(
    await account.signIn({
      companyCode: "toggle-co",
      email: "toggle0@example.com",
      password: "sales123",
    })
  ).toEqual({ ok: false, error: "invalid" });

  const bob = await account.addPerson(customer.userId, {
    name: "Bob",
    email: "bob@example.com",
    password: "sales123",
    role: "SALES",
    companyId: customer.companyId,
  });
  if (!bob.ok) throw new Error(bob.error);
  expect(await account.seats(customer.accountId)).toMatchObject({ used: 5, free: 0 });

  expect(await account.setActive(customer.userId, aliceId, true)).toEqual({
    ok: false,
    error: "seats-full",
  });
  expect(await account.person(aliceId)).toMatchObject({ active: false });

  expect(await account.setActive(customer.userId, bob.userId, false)).toEqual({ ok: true });
  expect(await account.setActive(customer.userId, aliceId, true)).toEqual({ ok: true });
  expect(await account.seats(customer.accountId)).toMatchObject({ used: 5, free: 0 });
  expect(
    await account.signIn({
      companyCode: "toggle-co",
      email: "toggle0@example.com",
      password: "sales123",
    })
  ).toMatchObject({ ok: true, userId: aliceId });
});

test("the main admin cannot be disabled or removed and keeps a seat", async () => {
  const customer = await signUpCustomer({
    companyCode: "main-co",
    companyName: "Main Co",
  });

  expect(await account.setActive(customer.userId, customer.userId, false)).toEqual({
    ok: false,
    error: "main-admin",
  });
  expect(await account.removePerson(customer.userId, customer.userId)).toEqual({
    ok: false,
    error: "main-admin",
  });
  expect(await account.person(customer.userId)).toMatchObject({
    isMainAdmin: true,
    active: true,
  });
  expect(await account.seats(customer.accountId)).toMatchObject({ used: 1, free: 4 });
});

test("creating a company uses no seat and works when seats are full", async () => {
  const customer = await signUpCustomer({
    companyCode: "co-full",
    companyName: "Company Full",
  });
  const pat = await account.addPerson(customer.userId, {
    name: "Pat Admin",
    email: "pat-full@example.com",
    password: "admin123",
    role: "ADMIN",
    companyId: customer.companyId,
  });
  if (!pat.ok) throw new Error(pat.error);
  await fillRemainingSeats(customer.userId, customer.companyId, 3, "cofull");
  expect(await account.seats(customer.accountId)).toMatchObject({ used: 5, free: 0 });

  const created = await account.createCompany(customer.userId, {
    name: "Extra Brand",
    currentCompanyId: customer.companyId,
  });
  if (!created.ok) throw new Error(created.error);
  expect(created.name).toBe("Extra Brand");
  expect(await account.seats(customer.accountId)).toMatchObject({ used: 5, free: 0 });

  expect(
    await account.addPerson(customer.userId, {
      name: "New Person",
      email: "nobody-left@example.com",
      password: "sales123",
      role: "SALES",
      companyId: customer.companyId,
    })
  ).toEqual({ ok: false, error: "seats-full" });

  expect(
    await account.addPerson(customer.userId, {
      name: "Pat Admin",
      email: "pat-full@example.com",
      password: "admin123",
      role: "ADMIN",
      companyId: created.companyId,
    })
  ).toEqual({ ok: true, userId: pat.userId, created: false });
  expect(await account.seats(customer.accountId)).toMatchObject({ used: 5, free: 0 });
});

test("a salesperson cannot be added to a second company", async () => {
  const customer = await signUpCustomer({
    companyCode: "sales-co",
    companyName: "Sales Co",
  });
  const second = await account.createCompany(customer.userId, {
    name: "Sales Two",
    currentCompanyId: customer.companyId,
  });
  if (!second.ok) throw new Error(second.error);

  const alice = await account.addPerson(customer.userId, {
    name: "Alice",
    email: "alice-sales@example.com",
    password: "sales123",
    role: "SALES",
    companyId: customer.companyId,
  });
  if (!alice.ok) throw new Error(alice.error);
  expect(
    await account.addPerson(customer.userId, {
      name: "Alice",
      email: "alice-sales@example.com",
      password: "sales123",
      role: "SALES",
      companyId: second.companyId,
    })
  ).toEqual({ ok: false, error: "sales-other-company" });
});

test("other admins can see seats but not the bill", async () => {
  const customer = await signUpCustomer({
    companyCode: "view-co",
    companyName: "View Co",
  });
  const other = await account.addPerson(customer.userId, {
    name: "Other Admin",
    email: "viewer@example.com",
    password: "admin123",
    role: "ADMIN",
    companyId: customer.companyId,
  });
  if (!other.ok) throw new Error(other.error);

  expect(await account.seatsFor(other.userId)).toEqual({
    ok: true,
    purchased: 5,
    used: 2,
    free: 3,
  });
  expect(await account.billFor(other.userId)).toEqual({
    ok: false,
    error: "forbidden",
  });
  expect(await account.billFor(customer.userId)).toEqual({
    ok: true,
    quantity: 1,
    interval: "month",
    currency: "SGD",
  });
});

test("the operator account can add people with no seat refusal", async () => {
  const opened = await openOperator();
  for (let i = 0; i < 8; i++) {
    const added = await account.addPerson(opened.userId, {
      name: `Op ${i}`,
      email: `op${i}@example.com`,
      password: "sales123",
      role: "SALES",
      companyId: opened.companyId,
    });
    expect(added.ok).toBe(true);
  }
  expect(await account.seatsFor(opened.userId)).toEqual({
    ok: true,
    exempt: true,
    used: 9,
  });
  expect(await account.billFor(opened.userId)).toEqual({
    ok: false,
    error: "forbidden",
  });
});

test("a renewal failure starts a 7-day grace: people work, add is refused, company ok, main admin to billing", async () => {
  const customer = await signUpCustomer({
    companyCode: "grace-co",
    companyName: "Grace Co",
  });
  const sales = await account.addPerson(customer.userId, {
    name: "Sales",
    email: "sales-grace@example.com",
    password: "sales123",
    role: "SALES",
    companyId: customer.companyId,
  });
  if (!sales.ok) throw new Error(sales.error);

  const failedAt = new Date();
  expect(
    await account.reportRenewalFailure(customer.accountId, paymentPort({ failedAt }))
  ).toEqual({ ok: true });

  expect(
    await account.signIn({
      companyCode: "grace-co",
      email: "sales-grace@example.com",
      password: "sales123",
    })
  ).toEqual({
    ok: true,
    userId: sales.userId,
    name: "Sales",
    role: "SALES",
    companyId: customer.companyId,
    access: "full",
  });
  expect(
    await account.signIn({
      companyCode: "grace-co",
      email: "new@example.com",
      password: "secret1",
    })
  ).toEqual({
    ok: true,
    userId: customer.userId,
    name: "New Admin",
    role: "ADMIN",
    companyId: customer.companyId,
    access: "billing",
  });

  expect(
    await account.addPerson(customer.userId, {
      name: "Extra",
      email: "extra-grace@example.com",
      password: "sales123",
      role: "SALES",
      companyId: customer.companyId,
    })
  ).toEqual({ ok: false, error: "billing" });

  const created = await account.createCompany(customer.userId, {
    name: "Grace Brand Two",
    currentCompanyId: customer.companyId,
  });
  expect(created.ok).toBe(true);
});

test("after 7 days without payment, only the main admin can sign in, and only to pay", async () => {
  const customer = await signUpCustomer({
    companyCode: "lock-co",
    companyName: "Lock Co",
  });
  const sales = await account.addPerson(customer.userId, {
    name: "Sales",
    email: "sales-lock@example.com",
    password: "sales123",
    role: "SALES",
    companyId: customer.companyId,
  });
  if (!sales.ok) throw new Error(sales.error);

  const failedAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  expect(
    await account.reportRenewalFailure(customer.accountId, paymentPort({ failedAt }))
  ).toEqual({ ok: true });

  expect(
    await account.signIn({
      companyCode: "lock-co",
      email: "sales-lock@example.com",
      password: "sales123",
    })
  ).toEqual({ ok: false, error: "invalid" });
  expect(
    await account.signIn({
      companyCode: "lock-co",
      email: "new@example.com",
      password: "secret1",
    })
  ).toEqual({
    ok: true,
    userId: customer.userId,
    name: "New Admin",
    role: "ADMIN",
    companyId: customer.companyId,
    access: "pay-only",
  });

  expect(
    await account.createCompany(customer.userId, {
      name: "Locked Brand",
      currentCompanyId: customer.companyId,
    })
  ).toEqual({ ok: false, error: "billing" });
  expect(
    await account.addPerson(customer.userId, {
      name: "Extra",
      email: "extra-lock@example.com",
      password: "sales123",
      role: "SALES",
      companyId: customer.companyId,
    })
  ).toEqual({ ok: false, error: "billing" });
});

test("a successful payment clears grace and restores sign-in and adding", async () => {
  const customer = await signUpCustomer({
    companyCode: "clear-co",
    companyName: "Clear Co",
  });
  const sales = await account.addPerson(customer.userId, {
    name: "Sales",
    email: "sales-clear@example.com",
    password: "sales123",
    role: "SALES",
    companyId: customer.companyId,
  });
  if (!sales.ok) throw new Error(sales.error);

  const failedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  expect(
    await account.reportRenewalFailure(customer.accountId, paymentPort({ failedAt }))
  ).toEqual({ ok: true });
  expect(
    await account.signIn({
      companyCode: "clear-co",
      email: "sales-clear@example.com",
      password: "sales123",
    })
  ).toEqual({ ok: false, error: "invalid" });

  expect(
    await account.reportPaymentSuccess(customer.accountId, paymentPort({ paymentOk: true }))
  ).toEqual({ ok: true });

  expect(
    await account.signIn({
      companyCode: "clear-co",
      email: "sales-clear@example.com",
      password: "sales123",
    })
  ).toMatchObject({ ok: true, userId: sales.userId, access: "full" });
  expect(
    await account.signIn({
      companyCode: "clear-co",
      email: "new@example.com",
      password: "secret1",
    })
  ).toMatchObject({ ok: true, userId: customer.userId, access: "full" });
  expect(
    await account.addPerson(customer.userId, {
      name: "After Pay",
      email: "after-pay@example.com",
      password: "sales123",
      role: "SALES",
      companyId: customer.companyId,
    })
  ).toMatchObject({ ok: true, created: true });
});

test("the operator account is never locked by a failed renewal", async () => {
  const opened = await openOperator();
  const sales = await account.addPerson(opened.userId, {
    name: "Op Sales",
    email: "op-sales@example.com",
    password: "sales123",
    role: "SALES",
    companyId: opened.companyId,
  });
  if (!sales.ok) throw new Error(sales.error);

  expect(
    await account.reportRenewalFailure(
      opened.accountId,
      paymentPort({ failedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
    )
  ).toEqual({ ok: true });

  expect(
    await account.signIn({
      companyCode: "alpha-vitality",
      email: "op-sales@example.com",
      password: "sales123",
    })
  ).toMatchObject({ ok: true, userId: sales.userId, access: "full" });
  expect(
    await account.addPerson(opened.userId, {
      name: "Still Ok",
      email: "still-ok@example.com",
      password: "sales123",
      role: "SALES",
      companyId: opened.companyId,
    })
  ).toMatchObject({ ok: true, created: true });
});
