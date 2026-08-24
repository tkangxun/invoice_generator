# Sales Invoicing App

A web app for the sales team to generate invoices and receipts, and track their own sales.

## Features

- Individual login for each salesperson (admins see everyone's documents; salespeople see only their own)
- Create invoices with items picked from a shared price list (or custom line items)
- Auto-generated sequential numbering: `INV-2026-0001`, `RCP-2026-0001` (resets each year)
- Record payment on an invoice to mark it paid and automatically generate the linked receipt
- Printable A4 invoice and receipt documents (use the browser's "Save as PDF")
- Dashboard with each salesperson's invoice count, unpaid count, and collected sales

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

| Email             | Password | Role  |
| ----------------- | -------- | ----- |
| admin@example.com | admin123 | Admin |
| alice@example.com | sales123 | Sales |
| ben@example.com   | sales123 | Sales |

Change these before real use. Production seed never creates these accounts.

## Host on Railway

1. Push this `app` folder to a GitHub repository (the folder that contains `package.json`, not the parent `Invoice Generator` folder).
2. In [Railway](https://railway.com/new), create a project and choose **Deploy from GitHub repo**.
3. Add a database: **+ New → Database → PostgreSQL**.
4. On the app service, **Variables**:
   - `DATABASE_URL` = a **reference** to the Postgres service `DATABASE_URL` (`${{Postgres.DATABASE_URL}}`)
   - `SESSION_SECRET` = a random string of at least 32 characters
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` = the first admin account (used when you seed)
5. Leave **Settings → Deploy → Pre-deploy Command** empty. Migrations run when the app starts (`npm start`).
6. **Settings → Networking → Generate Domain**.
7. After the first successful deploy, create the admin and price list once:

   ```bash
   npm i -g @railway/cli
   railway login
   railway link
   railway run npm run db:seed
   ```

   Or in Railway: the app service → **Settings → One-off command** → `npm run db:seed`.

The public URL will prompt you to log in with `ADMIN_EMAIL`. Change that password after first login if you want, and add salespeople under Settings → Users.

Do not seed the demo `admin@example.com` / `alice@example.com` accounts on Railway.

## Things to customise

- **Company details** shown on invoices/receipts: `lib/company.ts`
- **Price list**: Settings → Price list in the app, or `prisma/seed.ts`
- **Currency** (default SGD): `lib/money.ts`
- **Invoice/receipt layout**: `app/print/invoices/[id]/page.tsx` and `app/print/receipts/[id]/page.tsx`

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL via Prisma ORM
- iron-session cookie sessions, bcryptjs password hashing

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string |
| `SESSION_SECRET` | Yes | Encrypts session cookies (min 32 characters) |
| `ADMIN_EMAIL` | Seed only | First admin login |
| `ADMIN_PASSWORD` | Seed only | First admin password (min 6 characters) |
| `ADMIN_NAME` | Seed only | First admin display name (default `Admin`) |
