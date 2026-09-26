import { redirect } from "next/navigation";
import { createAccount } from "@/lib/account";
import { buyPackAction, dropPackAction } from "@/lib/actions/billing";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { stripeConfigured } from "@/lib/stripe-billing";

const messages: Record<string, string> = {
  forbidden: "Only the main admin can change packs.",
  "payment-failed": "Card update failed. Pack count was not changed.",
  "in-use": "Dropping a pack needs at least 5 unused seats.",
  "last-pack": "The first pack cannot be dropped.",
  "not-configured": "Card payment is not configured.",
};

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; bought?: string; dropped?: string }>;
}) {
  const user = await requireAdmin();
  const account = createAccount(prisma);
  const bill = await account.billFor(user.userId);
  if (!bill.ok) redirect("/admin/users");

  const seats = await account.seatsFor(user.userId);
  const { error, bought, dropped } = await searchParams;
  const canDrop =
    seats.ok &&
    !("exempt" in seats) &&
    bill.quantity > 1 &&
    seats.free >= 5;

  return (
    <div>
      <h1 className="text-xl font-bold">Billing</h1>
      <p className="mt-1 text-sm text-gray-500">
        Seat packs are sold in groups of 5. The monthly charge follows the number
        of packs, not the number of people.
      </p>

      {error && messages[error] ? (
        <p className="mt-3 text-sm text-red-600">{messages[error]}</p>
      ) : null}
      {bought ? (
        <p className="mt-3 text-sm text-green-700">
          Pack purchased. Five seats were added.
        </p>
      ) : null}
      {dropped ? (
        <p className="mt-3 text-sm text-green-700">
          Pack dropped. Five seats were removed.
        </p>
      ) : null}

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Subscription</h2>
        <dl className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-gray-500">Packs</dt>
            <dd className="mt-0.5 font-semibold">{bill.quantity}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Interval</dt>
            <dd className="mt-0.5 font-semibold">Monthly</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Currency</dt>
            <dd className="mt-0.5 font-semibold">{bill.currency}</dd>
          </div>
        </dl>
        {seats.ok && !("exempt" in seats) ? (
          <p className="mt-4 text-sm text-gray-600">
            Seats: {seats.used} used of {seats.purchased} purchased ({seats.free}{" "}
            free).
          </p>
        ) : null}
        {!stripeConfigured() ? (
          <p className="mt-4 text-sm text-amber-700">
            Card payment is not configured on this deployment.
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <form action={buyPackAction}>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Buy a pack (+5 seats)
            </button>
          </form>
          <form action={dropPackAction}>
            <button
              type="submit"
              disabled={!canDrop}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Drop a pack (−5 seats)
            </button>
          </form>
        </div>
        {!canDrop && bill.quantity <= 1 ? (
          <p className="mt-3 text-xs text-gray-500">
            The first pack cannot be dropped.
          </p>
        ) : null}
        {!canDrop &&
        bill.quantity > 1 &&
        seats.ok &&
        !("exempt" in seats) &&
        seats.free < 5 ? (
          <p className="mt-3 text-xs text-gray-500">
            Free at least 5 seats before dropping a pack.
          </p>
        ) : null}
      </div>
    </div>
  );
}
