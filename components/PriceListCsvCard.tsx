"use client";

import { useActionState } from "react";
import {
  importPriceList,
  type ImportPriceListState,
} from "@/lib/actions/admin";

const initialState: ImportPriceListState = {};

export function PriceListCsvCard() {
  const [state, formAction, pending] = useActionState(
    importPriceList,
    initialState
  );

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">CSV</h2>
          <p className="mt-1 text-sm text-gray-500">
            Export the current list, edit it in a spreadsheet, then import.
            Rows with an existing id or sku are updated; other rows are added.
            If you import a full export, CSV row order becomes the dropdown
            order. Type values must match this company's item types (name or
            CSV slug). Existing invoices keep the prices they were created with.
          </p>
        </div>
        <a
          href="/admin/items/export"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          Export CSV
        </a>
      </div>
      <form
        action={formAction}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <label className="block min-w-[16rem] flex-1 text-sm font-medium text-gray-700">
          Import CSV
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-50"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </form>
      {state.error && (
        <p className="mt-3 text-sm text-red-600">{state.error}</p>
      )}
      {state.errors && state.errors.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-600">
          {state.errors.slice(0, 15).map((message) => (
            <li key={message}>{message}</li>
          ))}
          {state.errors.length > 15 && (
            <li>And {state.errors.length - 15} more.</li>
          )}
        </ul>
      )}
      {(state.created != null || state.updated != null) && !state.error && (
        <p className="mt-3 text-sm text-green-700">
          Imported {state.created ?? 0} new and {state.updated ?? 0} updated.
        </p>
      )}
    </div>
  );
}
