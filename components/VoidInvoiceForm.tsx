"use client";

import { useState } from "react";
import { voidInvoice } from "@/lib/actions/invoices";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { VOID_REASONS } from "@/lib/void-reasons";

export function VoidInvoiceForm({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        Void invoice
      </button>
    );
  }

  return (
    <form
      action={voidInvoice.bind(null, invoiceId)}
      className="w-72 rounded-lg border border-red-200 bg-red-50 p-3"
    >
      <label className="block text-sm font-medium text-red-900">
        Reason for voiding *
        <select
          name="voidReason"
          required
          defaultValue=""
          className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-red-400 focus:outline-none"
        >
          <option value="" disabled>
            Select a reason
          </option>
          {VOID_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white"
        >
          Cancel
        </button>
        <ConfirmSubmitButton
          confirmMessage={`Void ${invoiceNumber}? All follow-up invoices and receipts will be deleted. This cannot be undone.`}
          className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800"
        >
          Confirm void
        </ConfirmSubmitButton>
      </div>
    </form>
  );
}
