"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { bulkDeleteInvoices } from "@/lib/actions/invoices";

export type InvoiceListRow = {
  id: string;
  number: string;
  customerName: string;
  salesperson?: string;
  issuedAtLabel: string;
  totalLabel: string;
  balanceLabel: string;
  status: string;
  voidReason: string | null;
};

export type InvoiceListColumn = {
  key: string;
  label: string;
  href: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "right";
};

export function InvoiceListTable({
  invoices,
  columns,
  isAdmin,
}: {
  invoices: InvoiceListRow[];
  columns: InvoiceListColumn[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locallyDeleted, setLocallyDeleted] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(
    () => invoices.filter((invoice) => !locallyDeleted.includes(invoice.id)),
    [invoices, locallyDeleted]
  );

  useEffect(() => {
    setLocallyDeleted((current) =>
      current.filter((id) => invoices.some((invoice) => invoice.id === id))
    );
  }, [invoices]);

  const visibleIds = useMemo(() => rows.map((invoice) => invoice.id), [rows]);
  const visibleIdKey = visibleIds.join(",");

  useEffect(() => {
    const ids = new Set(visibleIds);
    setSelected((current) => {
      const next = current.filter((id) => ids.has(id));
      return next.length === current.length ? current : next;
    });
  }, [visibleIdKey, visibleIds]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedRows = rows.filter((invoice) => selectedSet.has(invoice.id));
  const voidedSelected = selectedRows.filter(
    (invoice) => invoice.status === "VOIDED"
  );
  const canDelete =
    selectedRows.length > 0 && voidedSelected.length === selectedRows.length;
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  const someSelected = selectedRows.length > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  function toggleAll() {
    setSelected(allSelected ? [] : visibleIds);
  }

  function toggleOne(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function deleteSelected() {
    if (!canDelete) {
      setMessage("Only voided invoices can be deleted.");
      return;
    }
    if (
      !window.confirm(
        `Permanently delete ${voidedSelected.length} voided invoice${
          voidedSelected.length === 1 ? "" : "s"
        }? This cannot be undone.`
      )
    ) {
      return;
    }

    const removing = new Set(voidedSelected.map((invoice) => invoice.id));
    setMessage(null);
    startTransition(async () => {
      const result = await bulkDeleteInvoices([...removing]);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setLocallyDeleted((current) => [...new Set([...current, ...removing])]);
      setSelected((current) => current.filter((id) => !removing.has(id)));
      setMessage(
        `Deleted ${result.count} invoice${result.count === 1 ? "" : "s"}.`
      );
      router.refresh();
    });
  }

  return (
    <div>
      {isAdmin && (
        <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="pb-2 text-sm text-gray-600">
            {selectedRows.length === 0
              ? "Select voided invoices to delete."
              : canDelete
                ? `${selectedRows.length} voided selected`
                : "Delete is only available for voided invoices."}
          </p>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={pending || !canDelete}
            className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Working…" : "Delete selected"}
          </button>
        </div>
      )}
      {message && (
        <p className="border-b border-gray-100 px-5 py-2 text-sm text-gray-700">
          {message}
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            {isAdmin && (
              <th className="w-10 px-5 py-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all invoices on this list"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 py-3 font-medium ${
                  col.align === "right" ? "text-right" : ""
                }`}
              >
                <Link
                  href={col.href}
                  className="inline-flex items-center gap-1 hover:text-gray-800"
                >
                  {col.label}
                  {col.active && (
                    <span aria-hidden className="text-gray-400">
                      {col.dir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={isAdmin ? columns.length + 1 : columns.length}
                className="px-5 py-10 text-center text-sm text-gray-500"
              >
                No invoices left on this list.
              </td>
            </tr>
          ) : null}
          {rows.map((inv) => (
            <tr key={inv.id} className="border-t border-gray-100 hover:bg-gray-50">
              {isAdmin && (
                <td className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(inv.id)}
                    onChange={() => toggleOne(inv.id)}
                    aria-label={`Select ${inv.number}`}
                  />
                </td>
              )}
              <td className="px-5 py-3">
                <Link
                  href={`/invoices/${inv.id}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {inv.number}
                </Link>
              </td>
              <td className="px-5 py-3">{inv.customerName}</td>
              {isAdmin && (
                <td className="px-5 py-3">{inv.salesperson}</td>
              )}
              <td className="px-5 py-3">{inv.issuedAtLabel}</td>
              <td className="px-5 py-3 text-right">{inv.totalLabel}</td>
              <td className="px-5 py-3 text-right">{inv.balanceLabel}</td>
              <td className="px-5 py-3">
                <StatusBadge status={inv.status} />
                {inv.status === "VOIDED" && inv.voidReason && (
                  <div className="mt-0.5 text-xs text-gray-500">
                    {inv.voidReason}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
