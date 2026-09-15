"use client";

import { useActionState } from "react";
import {
  createCompany,
  type CreateCompanyState,
} from "@/lib/actions/admin";

const inputCls =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

const initialState: CreateCompanyState = {};

export function CreateCompanyForm() {
  const [state, formAction, pending] = useActionState(
    createCompany,
    initialState
  );

  return (
    <form action={formAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
      <label className="block text-xs font-medium text-gray-500 sm:col-span-3">
        Company ID *
        <input name="code" required placeholder="event-booth" className={inputCls} />
      </label>
      <label className="block text-xs font-medium text-gray-500 sm:col-span-4">
        Name *
        <input name="name" required placeholder="Event booth" className={inputCls} />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-3 sm:pt-6">
        <input type="checkbox" name="copyPriceList" className="rounded border-gray-300" />
        Copy this price list
      </label>
      <div className="sm:col-span-2 sm:pt-5">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      {state.error && (
        <p className="text-sm text-red-600 sm:col-span-12">{state.error}</p>
      )}
    </form>
  );
}
