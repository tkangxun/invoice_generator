"use client";

import { useActionState } from "react";
import Link from "next/link";
import { beginSignup, type SignupState } from "@/lib/actions/signup";

const initialState: SignupState = {};

export function SignupForm({
  canceled,
  error,
}: {
  canceled: boolean;
  error?: string;
}) {
  const [state, formAction, pending] = useActionState(beginSignup, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pay for 5 seats. You use 1, and 4 are left for other people.
          </p>
        </div>
        <form
          action={formAction}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <Field label="Your name" name="name" autoComplete="name" />
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field label="Password" name="password" type="password" autoComplete="new-password" />
          <Field label="Company name" name="companyName" autoComplete="organization" />
          <Field
            label="Company ID"
            name="companyCode"
            autoComplete="off"
            placeholder="e.g. alpha-vitality"
          />
          {canceled && (
            <p className="mt-3 text-sm text-gray-600">
              Payment was canceled. Nothing was created.
            </p>
          )}
          {(state.error || error) && (
            <p className="mt-3 text-sm text-red-600">{state.error ?? error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Starting payment…" : "Pay for 5 seats"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/login" className="text-blue-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="mt-4 block text-sm font-medium text-gray-700 first:mt-0">
      {label}
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}
