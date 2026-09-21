# Sales Invoicing App

A web app for the sales team to generate invoices and receipts, and track their own sales.

## Features

- Login with **company ID + email + password**. One email is one person and one role. A salesperson belongs to a single company. An admin can belong to several companies and switch from the header. The same email cannot be a salesperson in one company and an admin in another.
- Each company has its own letterhead, price list, users, and invoice/receipt numbers
- Create invoices from that company’s price list (or custom line items)
- Auto-generated sequential numbering per company, resetting each year: `INV-2026-0001`, `RCP-2026-0001`. A partial payment is numbered from the invoice: `INV-2026-0001-a`, then `-b`, and so on.
- A payment smaller than the balance issues that follow-up invoice and leaves the original invoice partially paid. Paying the remaining balance marks the invoice paid and issues the linked receipt.
- Collected sales count money received on invoices that are not voided. When an invoice was paid in installments, those follow-ups are counted and the final receipt is not, so the same payment is not added twice.
- Printable A4 invoices, follow-up invoices, and receipts (use the browser's "Save as PDF")
- Dashboard: a salesperson sees their own invoice count, unpaid count (unpaid and partial), and collected sales. An admin sees company-wide figures — invoice count and collected sales for the selected year or month, and current unpaid — plus a **Sales by person** table for that same period. The invoice count includes voided invoices. The table lists every active salesperson, and any admin or disabled salesperson who has a non-voided sale in that company. In month view, a person’s unpaid count opens their unpaid invoices for that month.

## Getting started (local)

Postgres is required (same database used in production). From the `app` folder:

```bash
docker compose up -d
cp .env.example .env   # if you don't already have .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev            # http://localhost:3000
```

## Demo accounts (local seed only)

Company ID: `alpha-vitality`

| Email             | Password | Role  |
| ----------------- | -------- | ----- |
| admin@example.com | admin123 | Admin |
| alice@example.com | sales123 | Sales |
| ben@example.com   | sales123 | Sales |

Admins who hold more than one company can switch from the company menu in the header. Change these accounts before real use. Production never creates the demo emails.

## Host on Railway

1. Push this `app` folder to a GitHub repository (the folder that contains `package.json`, not the parent `Invoice Generator` folder).
2. In [Railway](https://railway.com/new), create a project and choose **Deploy from GitHub repo**.
3. Add a database: **+ New → Database → PostgreSQL**.
4. On the app service, **Variables**:
   - `DATABASE_URL` = a **reference** to the Postgres service `DATABASE_URL` (`${{Postgres.DATABASE_URL}}`)
   - `SESSION_SECRET` = a random string of at least 32 characters
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` = first admin, used only when the user table is empty
5. Leave **Settings → Deploy → Pre-deploy Command** empty. Migrations run when the app starts (`npm start`).
6. **Settings → Networking → Generate Domain**.

A brand-new empty database is bootstrapped on first start (admin, default company `alpha-vitality`, price list). **Do not run `db:seed` on Railway** — seed wipes that company’s price list.

After a multi-company cutover, everyone must sign in again. Company IDs are slugs of the old branding profile names, typically:

- `alpha-vitality` (former main letterhead)
- `event-booth`

Confirm the exact codes under Settings → Companies (or Invoice settings) after an admin logs in.

The public URL will prompt you to log in with company ID + `ADMIN_EMAIL`. Add salespeople under Settings → Users (they can only belong to one company).

## Things to customise

- **Company details** shown on invoices/receipts: Settings → Invoice, or `lib/company.ts`
- **Price list**: Settings → Price list in the app (per company), or `prisma/seed.ts` locally
- **Currency** (default SGD): `lib/money.ts`
- **Invoice/receipt layout**: `app/print/invoices/[id]/page.tsx`, `app/print/follow-up/[id]/page.tsx`, and `app/print/receipts/[id]/page.tsx`

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL via Prisma ORM
- iron-session cookie sessions, bcryptjs password hashing

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string |
| `SESSION_SECRET` | Yes | Encrypts session cookies (min 32 characters) |
| `ADMIN_EMAIL` | First boot only | First admin login if the user table is empty |
| `ADMIN_PASSWORD` | First boot only | First admin password (min 6 characters) |
| `ADMIN_NAME` | First boot only | First admin display name (default `Admin`) |
