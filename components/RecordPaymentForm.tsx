"use client";

import { useState, useTransition } from "react";
import { recordPayment } from "@/lib/actions/invoices";
import { formatCents, todayDateInput } from "@/lib/money";

const METHODS = [
  "Cash",
  "PayNow",
  "Bank Transfer",
  "Credit Card",
  "Cheque",
];

export function RecordPaymentForm({
  invoiceId,
  dueCents,
  methods,
}: {
  invoiceId: string;
  dueCents: number;
  methods: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaultAmount = (dueCents / 100).toFixed(2);
  const methodOptions = methods.length > 0 ? methods : METHODS;

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await recordPayment(invoiceId, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form
      action={submit}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="font-semibold">Record payment</h2>
      <p className="mt-1 text-sm text-gray-500">
        Smaller amounts issue a follow-up invoice. A receipt is issued when the
        invoice is paid in full.
      </p>
      <div className="mt-3 text-sm">
        <span className="text-gray-500">Balance due: </span>
        <span className="font-semibold">{formatCents(dueCents)}</span>
      </div>
      <label className="mt-4 block text-sm font-medium text-gray-700">
        Amount (S$)
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          max={defaultAmount}
          defaultValue={defaultAmount}
          required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </label>
      <label className="mt-4 block text-sm font-medium text-gray-700">
        Date paid
        <input
          name="paidAt"
          type="date"
          defaultValue={todayDateInput()}
          required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </label>
      <label className="mt-4 block text-sm font-medium text-gray-700">
        Payment method
        <select
          name="paymentMethod"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {methodOptions.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm font-medium text-gray-700">
        Payment notes (optional)
        <input
          name="notes"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="e.g. reference number"
        />
      </label>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}
