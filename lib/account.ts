import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { COMPANY_DEFAULTS, uniqueCompanyName } from "@/lib/company";
import { normalizeCompanyCode, uniqueCompanyCode } from "@/lib/company-code";
import type { PaymentPort } from "@/lib/payment-port";

export const OPERATOR_ACCOUNT_ID = "acc_operator";

export type AccountDb = PrismaClient | Prisma.TransactionClient;

export type OpenAccountInput = {
  exempt: boolean;
  admin: { name: string; email: string; password: string };
  company: { name: string; code: string };
};

export type OpenAccountResult =
  | {
      ok: true;
      accountId: string;
      userId: string;
      companyId: string;
      companyCode: string;
    }
  | { ok: false; error: "invalid" | "company-id-taken" };

export type SignInResult =
  | {
      ok: true;
      userId: string;
      name: string;
      role: string;
      companyId: string;
    }
  | { ok: false; error: "invalid" };

export type AddPersonInput = {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "SALES";
  companyId: string;
};

export type AddPersonResult =
  | { ok: true; userId: string; created: boolean }
  | {
      ok: false;
      error: "invalid" | "email-exists" | "sales-other-company" | "forbidden" | "seats-full";
    };

export type SetActiveResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "main-admin" | "seats-full" };

export type RemovePersonResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "main-admin" };

export type SeatsForResult =
  | { ok: true; purchased: number; used: number; free: number }
  | { ok: true; exempt: true; used: number }
  | { ok: false; error: "forbidden" };

export type BillForResult =
  | { ok: true; quantity: number; interval: string; currency: string }
  | { ok: false; error: "forbidden" };

export type BuyPackResult =
  | { ok: true; quantity: number }
  | { ok: false; error: "forbidden" | "payment-failed" };

export type DropPackResult =
  | { ok: true; quantity: number }
  | {
      ok: false;
      error: "forbidden" | "in-use" | "last-pack" | "payment-failed";
    };

export type CreateCompanyResult =
  | { ok: true; companyId: string; code: string; name: string }
  | { ok: false; error: "invalid" | "forbidden" };

export type CompanyChoice = { id: string; name: string; code: string };

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  companyName: string;
  companyCode: string;
};

export type SignUpResult =
  | {
      ok: true;
      accountId: string;
      userId: string;
      companyId: string;
      companyCode: string;
    }
  | { ok: false; error: "invalid" | "company-id-taken" | "payment-failed" };

const FIRST_PACK = {
  packs: 1,
  interval: "month",
  currency: "SGD",
} as const;

const INVALID_SIGN_IN = { ok: false as const, error: "invalid" as const };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createAccount(db: AccountDb) {
  async function seatState(accountId: string) {
    const account = await db.account.findUnique({
      where: { id: accountId },
      select: { exempt: true, packCount: true },
    });
    if (!account) return null;
    const used = await db.user.count({
      where: { accountId, active: true },
    });
    if (account.exempt) {
      return { exempt: true as const, used };
    }
    const purchased = account.packCount * 5;
    return {
      exempt: false as const,
      purchased,
      used,
      free: purchased - used,
    };
  }

  async function requireFreeSeat(accountId: string): Promise<
    { ok: true } | { ok: false; error: "seats-full" }
  > {
    const state = await seatState(accountId);
    if (!state) return { ok: false, error: "seats-full" };
    if (state.exempt) return { ok: true };
    if (state.free < 1) return { ok: false, error: "seats-full" };
    return { ok: true };
  }

  return {
    async openAccount(input: OpenAccountInput): Promise<OpenAccountResult> {
      const name = input.admin.name.trim();
      const email = normalizeEmail(input.admin.email);
      const companyName = input.company.name.trim();
      const companyCode = normalizeCompanyCode(input.company.code);
      if (!name || !email || input.admin.password.length < 6 || !companyName || !companyCode) {
        return { ok: false, error: "invalid" };
      }

      const taken = await db.company.findUnique({
        where: { code: companyCode },
        select: { id: true },
      });
      if (taken) return { ok: false, error: "company-id-taken" };

      const account = await db.account.create({
        data: { exempt: input.exempt },
        select: { id: true },
      });
      const company = await db.company.create({
        data: {
          accountId: account.id,
          code: companyCode,
          name: companyName.slice(0, 80),
          ...COMPANY_DEFAULTS,
        },
        select: { id: true, code: true },
      });
      const user = await db.user.create({
        data: {
          accountId: account.id,
          name,
          email,
          role: "ADMIN",
          passwordHash: await bcrypt.hash(input.admin.password, 10),
        },
        select: { id: true },
      });
      await db.companyMembership.create({
        data: { userId: user.id, companyId: company.id },
      });

      return {
        ok: true,
        accountId: account.id,
        userId: user.id,
        companyId: company.id,
        companyCode: company.code,
      };
    },

    async exemption(accountId: string): Promise<{ exempt: boolean } | null> {
      return db.account.findUnique({
        where: { id: accountId },
        select: { exempt: true },
      });
    },

    async signIn(input: {
      companyCode: string;
      email: string;
      password: string;
    }): Promise<SignInResult> {
      const companyCode = normalizeCompanyCode(input.companyCode);
      const email = normalizeEmail(input.email);
      if (!companyCode || !email || !input.password) return INVALID_SIGN_IN;

      const company = await db.company.findUnique({
        where: { code: companyCode },
        select: { id: true, accountId: true },
      });
      if (!company) return INVALID_SIGN_IN;

      const user = await db.user.findUnique({
        where: { accountId_email: { accountId: company.accountId, email } },
      });
      if (!user?.active) return INVALID_SIGN_IN;
      if (!(await bcrypt.compare(input.password, user.passwordHash))) {
        return INVALID_SIGN_IN;
      }

      const membership = await db.companyMembership.findUnique({
        where: {
          userId_companyId: { userId: user.id, companyId: company.id },
        },
        select: { userId: true },
      });
      if (!membership) return INVALID_SIGN_IN;

      return {
        ok: true,
        userId: user.id,
        name: user.name,
        role: user.role,
        companyId: company.id,
      };
    },

    async companiesFor(userId: string): Promise<CompanyChoice[]> {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { accountId: true },
      });
      if (!user) return [];

      const rows = await db.companyMembership.findMany({
        where: { userId, company: { accountId: user.accountId } },
        orderBy: { company: { name: "asc" } },
        select: { company: { select: { id: true, name: true, code: true } } },
      });
      return rows.map((row) => row.company);
    },

    async addPerson(
      actorUserId: string,
      input: AddPersonInput
    ): Promise<AddPersonResult> {
      const name = input.name.trim();
      const email = normalizeEmail(input.email);
      if (!name || !email || input.password.length < 6) {
        return { ok: false, error: "invalid" };
      }

      const actor = await db.user.findUnique({ where: { id: actorUserId } });
      if (!actor?.active || actor.role !== "ADMIN") {
        return { ok: false, error: "forbidden" };
      }

      const company = await db.company.findUnique({
        where: { id: input.companyId },
        select: { id: true, accountId: true },
      });
      if (!company || company.accountId !== actor.accountId) {
        return { ok: false, error: "forbidden" };
      }
      const actorMembership = await db.companyMembership.findUnique({
        where: {
          userId_companyId: { userId: actor.id, companyId: company.id },
        },
        select: { userId: true },
      });
      if (!actorMembership) return { ok: false, error: "forbidden" };

      const existing = await db.user.findUnique({
        where: { accountId_email: { accountId: actor.accountId, email } },
      });
      if (existing) {
        if (input.role === "ADMIN" && existing.role === "ADMIN") {
          await db.companyMembership.upsert({
            where: {
              userId_companyId: {
                userId: existing.id,
                companyId: company.id,
              },
            },
            create: { userId: existing.id, companyId: company.id },
            update: {},
          });
          return { ok: true, userId: existing.id, created: false };
        }
        if (input.role === "SALES" && existing.role === "SALES") {
          const memberships = await db.companyMembership.findMany({
            where: { userId: existing.id },
            select: { companyId: true },
          });
          if (memberships.some((row) => row.companyId === company.id)) {
            return { ok: false, error: "email-exists" };
          }
          if (memberships.length > 0) {
            return { ok: false, error: "sales-other-company" };
          }
          await db.companyMembership.create({
            data: { userId: existing.id, companyId: company.id },
          });
          return { ok: true, userId: existing.id, created: false };
        }
        return { ok: false, error: "email-exists" };
      }

      const seat = await requireFreeSeat(actor.accountId);
      if (!seat.ok) return seat;

      const created = await db.user.create({
        data: {
          accountId: actor.accountId,
          name,
          email,
          role: input.role,
          passwordHash: await bcrypt.hash(input.password, 10),
        },
        select: { id: true },
      });
      await db.companyMembership.create({
        data: { userId: created.id, companyId: company.id },
      });
      return { ok: true, userId: created.id, created: true };
    },

    async createCompany(
      actorUserId: string,
      input: { name: string; currentCompanyId: string }
    ): Promise<CreateCompanyResult> {
      const requestedName = input.name.trim();
      if (!requestedName) return { ok: false, error: "invalid" };

      const actor = await db.user.findUnique({ where: { id: actorUserId } });
      if (!actor?.active || actor.role !== "ADMIN") {
        return { ok: false, error: "forbidden" };
      }

      const current = await db.company.findUnique({
        where: { id: input.currentCompanyId },
      });
      if (!current || current.accountId !== actor.accountId) {
        return { ok: false, error: "forbidden" };
      }
      const membership = await db.companyMembership.findUnique({
        where: {
          userId_companyId: { userId: actor.id, companyId: current.id },
        },
        select: { userId: true },
      });
      if (!membership) return { ok: false, error: "forbidden" };

      const name = await uniqueCompanyName(db, requestedName, actor.accountId);
      const code = await uniqueCompanyCode(db, requestedName);
      const company = await db.company.create({
        data: {
          accountId: actor.accountId,
          code,
          name,
          brand: current.brand || COMPANY_DEFAULTS.brand,
          tagline: current.tagline || COMPANY_DEFAULTS.tagline,
          legalName: current.legalName || COMPANY_DEFAULTS.legalName,
          uen: current.uen || COMPANY_DEFAULTS.uen,
          address: current.address || COMPANY_DEFAULTS.address,
          paymentTerms: current.paymentTerms || COMPANY_DEFAULTS.paymentTerms,
          logoMime: current.logoMime,
          logoBytes: current.logoBytes,
          paynowQrMime: current.paynowQrMime,
          paynowQrBytes: current.paynowQrBytes,
        },
        select: { id: true, code: true, name: true },
      });
      await db.companyMembership.create({
        data: { userId: actor.id, companyId: company.id },
      });
      return {
        ok: true,
        companyId: company.id,
        code: company.code,
        name: company.name,
      };
    },

    async inspectSignUp(
      input: SignUpInput
    ): Promise<{ ok: true; companyCode: string; email: string } | { ok: false; error: "invalid" | "company-id-taken" }> {
      const name = input.name.trim();
      const email = normalizeEmail(input.email);
      const companyName = input.companyName.trim();
      const companyCode = normalizeCompanyCode(input.companyCode);
      if (!name || !email || input.password.length < 6 || !companyName || !companyCode) {
        return { ok: false, error: "invalid" };
      }
      const taken = await db.company.findUnique({
        where: { code: companyCode },
        select: { id: true },
      });
      if (taken) return { ok: false, error: "company-id-taken" };
      return { ok: true, companyCode, email };
    },

    async signUp(input: SignUpInput, payment: PaymentPort): Promise<SignUpResult> {
      const ready = await this.inspectSignUp(input);
      if (!ready.ok) return ready;

      const paid = await payment.chargeFirstPack({
        email: ready.email,
        ...FIRST_PACK,
      });
      if (!paid.ok) return { ok: false, error: "payment-failed" };

      const existing = await db.account.findUnique({
        where: { stripeSubscriptionId: paid.subscriptionId },
        select: {
          id: true,
          users: { where: { isMainAdmin: true }, select: { id: true }, take: 1 },
          companies: { select: { id: true, code: true }, take: 1 },
        },
      });
      const existingUser = existing?.users[0];
      const existingCompany = existing?.companies[0];
      if (existing && existingUser && existingCompany) {
        return {
          ok: true,
          accountId: existing.id,
          userId: existingUser.id,
          companyId: existingCompany.id,
          companyCode: existingCompany.code,
        };
      }

      const name = input.name.trim();
      const companyName = input.companyName.trim().slice(0, 80);
      const passwordHash = await bcrypt.hash(input.password, 10);
      const write = async (tx: AccountDb) => {
        const account = await tx.account.create({
          data: {
            exempt: false,
            packCount: FIRST_PACK.packs,
            billingInterval: FIRST_PACK.interval,
            currency: FIRST_PACK.currency,
            stripeCustomerId: paid.customerId,
            stripeSubscriptionId: paid.subscriptionId,
          },
          select: { id: true },
        });
        const company = await tx.company.create({
          data: {
            accountId: account.id,
            code: ready.companyCode,
            name: companyName,
            ...COMPANY_DEFAULTS,
          },
          select: { id: true, code: true },
        });
        const user = await tx.user.create({
          data: {
            accountId: account.id,
            name,
            email: ready.email,
            role: "ADMIN",
            isMainAdmin: true,
            passwordHash,
          },
          select: { id: true },
        });
        await tx.companyMembership.create({
          data: { userId: user.id, companyId: company.id },
        });
        return {
          ok: true as const,
          accountId: account.id,
          userId: user.id,
          companyId: company.id,
          companyCode: company.code,
        };
      };

      if ("$transaction" in db) {
        return db.$transaction(write);
      }
      return write(db);
    },

    async seats(accountId: string) {
      const account = await db.account.findUnique({
        where: { id: accountId },
        select: { packCount: true },
      });
      if (!account) return null;
      const used = await db.user.count({
        where: { accountId, active: true },
      });
      const purchased = account.packCount * 5;
      return {
        packs: account.packCount,
        purchased,
        used,
        free: purchased - used,
      };
    },

    async seatsFor(actorUserId: string): Promise<SeatsForResult> {
      const actor = await db.user.findUnique({ where: { id: actorUserId } });
      if (!actor?.active || actor.role !== "ADMIN") {
        return { ok: false, error: "forbidden" };
      }
      const state = await seatState(actor.accountId);
      if (!state) return { ok: false, error: "forbidden" };
      if (state.exempt) {
        return { ok: true, exempt: true, used: state.used };
      }
      return {
        ok: true,
        purchased: state.purchased,
        used: state.used,
        free: state.free,
      };
    },

    async subscription(accountId: string) {
      const account = await db.account.findUnique({
        where: { id: accountId },
        select: {
          packCount: true,
          billingInterval: true,
          currency: true,
          stripeSubscriptionId: true,
        },
      });
      if (!account?.stripeSubscriptionId) return null;
      return {
        quantity: account.packCount,
        interval: account.billingInterval,
        currency: account.currency,
      };
    },

    async billFor(actorUserId: string): Promise<BillForResult> {
      const actor = await db.user.findUnique({ where: { id: actorUserId } });
      if (!actor?.active || actor.role !== "ADMIN" || !actor.isMainAdmin) {
        return { ok: false, error: "forbidden" };
      }
      const bill = await this.subscription(actor.accountId);
      if (!bill) return { ok: false, error: "forbidden" };
      return { ok: true, ...bill };
    },

    async buyPack(
      actorUserId: string,
      payment: PaymentPort
    ): Promise<BuyPackResult> {
      const actor = await db.user.findUnique({ where: { id: actorUserId } });
      if (!actor?.active || actor.role !== "ADMIN" || !actor.isMainAdmin) {
        return { ok: false, error: "forbidden" };
      }
      const account = await db.account.findUnique({
        where: { id: actor.accountId },
        select: {
          exempt: true,
          packCount: true,
          stripeSubscriptionId: true,
        },
      });
      if (!account || account.exempt || !account.stripeSubscriptionId) {
        return { ok: false, error: "forbidden" };
      }
      const quantity = account.packCount + 1;
      const paid = await payment.setPackQuantity({
        subscriptionId: account.stripeSubscriptionId,
        quantity,
      });
      if (!paid.ok) return { ok: false, error: "payment-failed" };
      await db.account.update({
        where: { id: actor.accountId },
        data: { packCount: quantity },
      });
      return { ok: true, quantity };
    },

    async dropPack(
      actorUserId: string,
      payment: PaymentPort
    ): Promise<DropPackResult> {
      const actor = await db.user.findUnique({ where: { id: actorUserId } });
      if (!actor?.active || actor.role !== "ADMIN" || !actor.isMainAdmin) {
        return { ok: false, error: "forbidden" };
      }
      const account = await db.account.findUnique({
        where: { id: actor.accountId },
        select: {
          exempt: true,
          packCount: true,
          stripeSubscriptionId: true,
        },
      });
      if (!account || account.exempt || !account.stripeSubscriptionId) {
        return { ok: false, error: "forbidden" };
      }
      if (account.packCount <= 1) {
        return { ok: false, error: "last-pack" };
      }
      const state = await seatState(actor.accountId);
      if (!state || state.exempt || state.free < 5) {
        return { ok: false, error: "in-use" };
      }
      const quantity = account.packCount - 1;
      const paid = await payment.setPackQuantity({
        subscriptionId: account.stripeSubscriptionId,
        quantity,
      });
      if (!paid.ok) return { ok: false, error: "payment-failed" };
      await db.account.update({
        where: { id: actor.accountId },
        data: { packCount: quantity },
      });
      return { ok: true, quantity };
    },

    async person(userId: string) {
      return db.user.findUnique({
        where: { id: userId },
        select: { isMainAdmin: true, role: true, active: true },
      });
    },

    async setActive(
      actorUserId: string,
      userId: string,
      active: boolean
    ): Promise<SetActiveResult> {
      const actor = await db.user.findUnique({ where: { id: actorUserId } });
      if (!actor?.active || actor.role !== "ADMIN") {
        return { ok: false, error: "forbidden" };
      }
      const target = await db.user.findUnique({ where: { id: userId } });
      if (!target || target.accountId !== actor.accountId) {
        return { ok: false, error: "forbidden" };
      }
      if (target.isMainAdmin && !active) {
        return { ok: false, error: "main-admin" };
      }
      if (active === target.active) {
        return { ok: true };
      }
      if (active) {
        const seat = await requireFreeSeat(actor.accountId);
        if (!seat.ok) return seat;
      }
      await db.user.update({ where: { id: userId }, data: { active } });
      return { ok: true };
    },

    async removePerson(
      actorUserId: string,
      userId: string
    ): Promise<RemovePersonResult> {
      const actor = await db.user.findUnique({ where: { id: actorUserId } });
      if (!actor?.active || actor.role !== "ADMIN") {
        return { ok: false, error: "forbidden" };
      }
      const target = await db.user.findUnique({ where: { id: userId } });
      if (!target || target.accountId !== actor.accountId) {
        return { ok: false, error: "forbidden" };
      }
      if (target.isMainAdmin) {
        return { ok: false, error: "main-admin" };
      }
      await db.user.delete({ where: { id: userId } });
      return { ok: true };
    },
  };
}
