"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, type LoginState } from "@/lib/actions/auth";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [companyLocked, setCompanyLocked] = useState(true);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Sales Invoicing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to generate invoices and receipts
          </p>
        </div>
        <form
          action={formAction}
          className="relative rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <input
            type="text"
            name="username"
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            suppressHydrationWarning
            className="pointer-events-none absolute h-0 w-0 opacity-0"
          />
          <label className="block text-sm font-medium text-gray-700">
            Company ID
            <input
              name="companyCode"
              required
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
              suppressHydrationWarning
              placeholder="e.g. alpha-vitality"
              readOnly={companyLocked}
              onFocus={() => setCompanyLocked(false)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              suppressHydrationWarning
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Password
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              suppressHydrationWarning
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          {state.error && (
            <p className="mt-3 text-sm text-red-600">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/signup" className="text-blue-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
