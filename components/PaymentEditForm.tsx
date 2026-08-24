"use client";

import { useState, useTransition } from "react";
import { updatePayment } from "@/lib/actions/invoices";

const inputCls =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

const METHODS = [
  "Cash",
  "PayNow",
  "Bank Transfer",
  "Credit Card",
  "Cheque",
];

export function PaymentEditForm({
  payment,
  maxAmount,
}: {
  payment: {
    id: string;
    number: string;
    amountCents: number;
    paymentMethod: string;
    notes: string | null;
    paidAt: string;
  };
  maxAmount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePayment(payment.id, formData);
      if (result && "error" in result && result.error) setError(result.error);
    });
  }

  return (
    <form action={submit} className="max-w-md space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">Editing {payment.number}</p>
      <label className="block text-sm font-medium text-gray-700">
        Amount (S$)
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          max={(maxAmount / 100).toFixed(2)}
          defaultValue={(payment.amountCents / 100).toFixed(2)}
          required
          className={inputCls}
        />
      </label>
      <label className="block text-sm font-medium text-gray-700">
        Date paid
        <input
          name="paidAt"
          type="date"
          defaultValue={payment.paidAt}
          required
          className={inputCls}
        />
      </label>
      <label className="block text-sm font-medium text-gray-700">
        Payment method
        <select
          name="paymentMethod"
          defaultValue={payment.paymentMethod}
          className={inputCls}
        >
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-gray-700">
        Payment notes (optional)
        <input
          name="notes"
          defaultValue={payment.notes ?? ""}
          className={inputCls}
          placeholder="e.g. reference number"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
