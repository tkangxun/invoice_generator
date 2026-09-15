"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import {
  CompanySwitcher,
  type SwitchableCompany,
} from "@/components/CompanySwitcher";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/receipts", label: "Receipts" },
];

export function AppNav({
  name,
  isAdmin,
  companyName,
  companyCode,
  currentCompanyId,
  companies,
  switchCompanyAction,
  logoutAction,
}: {
  name: string;
  isAdmin: boolean;
  companyName: string;
  companyCode: string;
  currentCompanyId: string;
  companies: SwitchableCompany[];
  switchCompanyAction: (formData: FormData) => Promise<void>;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const navLinks = [
    ...links,
    ...(isAdmin ? [{ href: "/admin", label: "Settings" }] : []),
  ];
  const canSwitchCompany = companies.length > 1;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/dashboard"
            className="truncate font-bold text-blue-700"
          >
            Sales Invoicing
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link
            href="/invoices/new"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <span className="md:hidden">+ New</span>
            <span className="hidden md:inline">+ New Invoice</span>
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            {canSwitchCompany ? (
              <CompanySwitcher
                companies={companies}
                currentCompanyId={currentCompanyId}
                switchAction={switchCompanyAction}
              />
            ) : (
              <span className="text-xs text-gray-400">
                {companyName} · {companyCode}
              </span>
            )}
            <span className="text-sm text-gray-500">{name}</span>
          </div>
          <form action={logoutAction} className="hidden md:block">
            <button
              type="submit"
              className="text-sm text-gray-500 underline hover:text-gray-900"
            >
              Log out
            </button>
          </form>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 md:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M6.7 6.7a1 1 0 0 1 1.4 0L12 10.6l3.9-3.9a1 1 0 1 1 1.4 1.4L13.4 12l3.9 3.9a1 1 0 1 1-1.4 1.4L12 13.4l-3.9 3.9a1 1 0 0 1-1.4-1.4L10.6 12 6.7 8.1a1 1 0 0 1 0-1.4Z"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M4 7a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5Z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
      {open && (
        <div
          id={menuId}
          className="border-t border-gray-100 bg-white md:hidden"
        >
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-2 text-sm font-medium">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-2 py-3 text-gray-700 hover:bg-gray-50"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-gray-100 pt-2">
              <p className="px-2 py-2 text-sm text-gray-500">{name}</p>
              {canSwitchCompany ? (
                <div className="px-2 pb-2">
                  <CompanySwitcher
                    companies={companies}
                    currentCompanyId={currentCompanyId}
                    switchAction={switchCompanyAction}
                  />
                </div>
              ) : (
                <p className="px-2 pb-2 text-xs text-gray-400">
                  {companyName} · {companyCode}
                </p>
              )}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full rounded-lg px-2 py-3 text-left text-gray-700 hover:bg-gray-50"
                >
                  Log out
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
