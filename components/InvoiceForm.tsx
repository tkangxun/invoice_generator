"use client";

import { useState, useTransition } from "react";
import { createInvoice, updateInvoice } from "@/lib/actions/invoices";
import { formatCents, dollarsToCents } from "@/lib/money";

type PriceItem = {
  id: string;
  name: string;
  priceCents: number;
  type: string; // service | supplement | package
  includes: string | null;
  active?: boolean;
};

type CollectionMode = "collected" | "credit" | "partial";

type LineRow = {
  key: number;
  itemId: string;
  description: string;
  qty: string;
  unitPrice: string; // in dollars, as typed
  collection: CollectionMode;
  collectedQty: string;
};

let nextKey = 1;

function emptyLine(): LineRow {
  return {
    key: nextKey++,
    itemId: "",
    description: "",
    qty: "1",
    unitPrice: "",
    collection: "collected",
    collectedQty: "1",
  };
}

function collectionFromSaved(
  qty: number,
  collectedQty: number | null | undefined
): { collection: CollectionMode; collectedQty: string } {
  const collected = collectedQty ?? qty;
  if (collected <= 0) return { collection: "credit", collectedQty: "0" };
  if (collected < qty) {
    return { collection: "partial", collectedQty: String(collected) };
  }
  return { collection: "collected", collectedQty: String(qty) };
}

// Matches the sample documents: "HBOT (Hyperbaric Oxygen Therapy) (5 sessions)"
function buildDescription(item: PriceItem, qty: number): string {
  if (item.type === "package") {
    return item.includes ? `${item.name} — includes ${item.includes}` : item.name;
  }
  if (qty > 1) {
    const unit = item.type === "supplement" ? "bottles" : "sessions";
    return `${item.name} (${qty} ${unit})`;
  }
  return item.name;
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export type InvoiceFormValues = {
  id: string;
  number: string;
  customerName: string;
  customerAddress: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;
  discountCents: number;
  dueAt: string;
  issuedAt: string;
  userId: string;
  lines: {
    itemId: string | null;
    description: string;
    qty: number;
    unitPriceCents: number;
    collectedQty: number | null;
  }[];
};

export type SalespersonOption = {
  id: string;
  name: string;
  active: boolean;
};

export function InvoiceForm({
  items,
  invoice,
  salespeople,
  currentUserId,
  companyName,
}: {
  items: PriceItem[];
  invoice?: InvoiceFormValues;
  salespeople?: SalespersonOption[];
  currentUserId?: string;
  companyName?: string;
}) {
  const isEdit = Boolean(invoice);
  const [customerName, setCustomerName] = useState(invoice?.customerName ?? "");
  const [customerAddress, setCustomerAddress] = useState(
    invoice?.customerAddress ?? ""
  );
  const [customerPhone, setCustomerPhone] = useState(invoice?.customerPhone ?? "");
  const [customerEmail, setCustomerEmail] = useState(invoice?.customerEmail ?? "");
  const [issuedAt, setIssuedAt] = useState(invoice?.issuedAt ?? "");
  const [dueAt, setDueAt] = useState(invoice?.dueAt ?? "");
  const [discount, setDiscount] = useState(
    invoice?.discountCents ? (invoice.discountCents / 100).toFixed(2) : ""
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [lines, setLines] = useState<LineRow[]>(
    invoice?.lines.length
      ? invoice.lines.map((l) => ({
          key: nextKey++,
          itemId: l.itemId ?? "",
          description: l.description,
          qty: String(l.qty),
          unitPrice: (l.unitPriceCents / 100).toFixed(2),
          ...collectionFromSaved(l.qty, l.collectedQty),
        }))
      : [emptyLine()]
  );
  const [ownerId, setOwnerId] = useState(
    invoice?.userId ?? currentUserId ?? salespeople?.[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateLine(key: number, patch: Partial<LineRow>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function selectItem(key: number, itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setLines((ls) =>
        ls.map((l) =>
          l.key === key
            ? {
                ...l,
                itemId,
                description: buildDescription(item, parseFloat(l.qty) || 1),
                unitPrice: (item.priceCents / 100).toFixed(2),
                collection: "collected",
                collectedQty: l.qty || "1",
              }
            : l
        )
      );
    } else {
      updateLine(key, {
        itemId: "",
        description: "",
        unitPrice: "",
        collection: "collected",
      });
    }
  }

  function changeQty(key: number, qty: string) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const item = items.find((i) => i.id === l.itemId);
        const qtyNum = parseFloat(qty) || 0;
        let collection = l.collection;
        let collectedQty = l.collectedQty;
        if (collection === "collected") collectedQty = qty;
        else if (collection === "credit") collectedQty = "0";
        else if (qtyNum <= 1) {
          collection = (parseFloat(l.collectedQty) || 0) > 0 ? "collected" : "credit";
          collectedQty = collection === "collected" ? qty : "0";
        } else {
          collectedQty = String(
            Math.min(Math.max(0, parseFloat(l.collectedQty) || 0), qtyNum)
          );
        }
        return {
          ...l,
          qty,
          collection,
          collectedQty,
          description: item
            ? buildDescription(item, parseFloat(qty) || 1)
            : l.description,
        };
      })
    );
  }

  const lineTotals = lines.map((l) => {
    const qty = parseFloat(l.qty) || 0;
    return Math.round(qty * dollarsToCents(l.unitPrice));
  });
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const discountCents = dollarsToCents(discount);
  const total = subtotal - discountCents;

  function submit() {
    setError(null);
    startTransition(async () => {
      const payload = {
        customerName,
        customerAddress,
        customerPhone,
        customerEmail,
        notes,
        discountCents,
        dueAt: dueAt || undefined,
        issuedAt: issuedAt || undefined,
        userId: ownerId || undefined,
        lines: lines.map((l) => {
          const qty = parseFloat(l.qty) || 0;
          const item = items.find((i) => i.id === l.itemId);
          let collectedQty: number | undefined;
          if (item?.type === "supplement") {
            if (l.collection === "credit") collectedQty = 0;
            else if (l.collection === "partial") {
              collectedQty = Math.min(
                qty,
                Math.max(0, parseFloat(l.collectedQty) || 0)
              );
            } else collectedQty = qty;
          }
          return {
            itemId: l.itemId || undefined,
            description: l.description,
            qty,
            unitPriceCents: dollarsToCents(l.unitPrice),
            collectedQty,
          };
        }),
      };
      const result = invoice
        ? await updateInvoice(invoice.id, payload)
        : await createInvoice(payload);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {isEdit && invoice && (
        <p className="text-sm text-gray-500">
          Editing {invoice.number}. The invoice number will not change.
        </p>
      )}

      {salespeople && salespeople.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Salesperson</h2>
          <p className="mt-1 text-sm text-gray-500">
            This invoice will appear under the selected user.
          </p>
          <label className="mt-4 block max-w-md text-sm font-medium text-gray-700">
            Assign to
            <select
              className={`mt-1 ${inputCls}`}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              {salespeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                  {!person.active ? " (disabled)" : ""}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {!isEdit && companyName && (
        <p className="text-sm text-gray-500">
          This invoice uses {companyName}.
        </p>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Customer</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Name *
            <input
              className={`mt-1 ${inputCls}`}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer or company name"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Phone
            <input
              className={`mt-1 ${inputCls}`}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Address
            <input
              className={`mt-1 ${inputCls}`}
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              className={`mt-1 ${inputCls}`}
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Line items</h2>
        <div className="mt-4 space-y-3">
          {lines.map((line, idx) => {
            const item = items.find((i) => i.id === line.itemId);
            const isSupplement = item?.type === "supplement";
            const qty = parseFloat(line.qty) || 0;
            return (
            <div key={line.key} className="border-b border-gray-100 pb-3">
            <div
              className="grid grid-cols-12 items-end gap-2"
            >
              <label className="col-span-12 block text-xs font-medium text-gray-500 sm:col-span-3">
                Item from price list
                <select
                  className={`mt-1 ${inputCls}`}
                  value={line.itemId}
                  onChange={(e) => selectItem(line.key, e.target.value)}
                >
                  <option value="">Custom / choose item…</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({formatCents(i.priceCents)})
                      {i.type === "package" ? " — package" : ""}
                      {i.active === false ? " (disabled)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-12 block text-xs font-medium text-gray-500 sm:col-span-4">
                Description
                <input
                  className={`mt-1 ${inputCls}`}
                  value={line.description}
                  onChange={(e) =>
                    updateLine(line.key, { description: e.target.value })
                  }
                  placeholder="What is being sold"
                />
              </label>
              <label className="col-span-3 block text-xs font-medium text-gray-500 sm:col-span-1">
                Qty
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={`mt-1 ${inputCls}`}
                  value={line.qty}
                  onChange={(e) => changeQty(line.key, e.target.value)}
                />
              </label>
              <label className="col-span-4 block text-xs font-medium text-gray-500 sm:col-span-2">
                Unit price ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`mt-1 ${inputCls}`}
                  value={line.unitPrice}
                  onChange={(e) =>
                    updateLine(line.key, { unitPrice: e.target.value })
                  }
                />
              </label>
              <div className="col-span-3 pb-2 text-right text-sm font-medium sm:col-span-1">
                {formatCents(lineTotals[idx])}
              </div>
              <div className="col-span-2 pb-1 text-right sm:col-span-1">
                <button
                  type="button"
                  onClick={() =>
                    setLines((ls) =>
                      ls.length > 1 ? ls.filter((l) => l.key !== line.key) : ls
                    )
                  }
                  className="text-sm text-red-500 hover:text-red-700"
                  title="Remove line"
                >
                  ✕
                </button>
              </div>
            </div>
            {isSupplement && (
              <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg bg-amber-50 px-3 py-2">
                <label className="block text-xs font-medium text-amber-900">
                  Supplement collection
                  <select
                    className={`mt-1 ${inputCls} max-w-xs bg-white`}
                    value={line.collection}
                    onChange={(e) => {
                      const collection = e.target.value as CollectionMode;
                      const qtyNum = parseFloat(line.qty) || 0;
                      const current = parseFloat(line.collectedQty);
                      const partialQty =
                        Number.isFinite(current) &&
                        current > 0 &&
                        current < qtyNum
                          ? line.collectedQty
                          : String(qtyNum > 1 ? 1 : 0);
                      updateLine(line.key, {
                        collection,
                        collectedQty:
                          collection === "collected"
                            ? line.qty
                            : collection === "credit"
                              ? "0"
                              : partialQty,
                      });
                    }}
                  >
                    <option value="collected">Collected on payment</option>
                    <option value="credit">Held as credit (not collected)</option>
                    {qty > 1 && (
                      <option value="partial">Partially collected</option>
                    )}
                  </select>
                </label>
                {line.collection === "partial" && (
                  <label className="block text-xs font-medium text-amber-900">
                    Bottles collected
                    <input
                      type="number"
                      min="0"
                      max={qty}
                      step="any"
                      className={`mt-1 ${inputCls} w-28 bg-white`}
                      value={line.collectedQty}
                      onChange={(e) =>
                        updateLine(line.key, { collectedQty: e.target.value })
                      }
                    />
                  </label>
                )}
                <p className="pb-2 text-xs text-amber-800">
                  {line.collection === "credit"
                    ? "All bottles stored as customer credit."
                    : line.collection === "partial"
                      ? `${line.collectedQty || 0} collected, remainder held as credit.`
                      : "All bottles collected when this invoice is paid."}
                </p>
              </div>
            )}
            </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, emptyLine()])}
          className="mt-4 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          + Add line
        </button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {isEdit && (
            <label className="block text-sm font-medium text-gray-700">
              Invoice date
              <input
                type="date"
                className={`mt-1 ${inputCls}`}
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
              />
            </label>
          )}
          <label className="block text-sm font-medium text-gray-700">
            Due date (blank = &quot;Upon receipt&quot;)
            <input
              type="date"
              className={`mt-1 ${inputCls}`}
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Discount ($)
            <input
              type="number"
              min="0"
              step="0.01"
              className={`mt-1 ${inputCls}`}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Notes (shown on invoice)
            <input
              className={`mt-1 ${inputCls}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCents(subtotal)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Discount</span>
                <span>-{formatCents(discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold">
              <span>Total</span>
              <span>{formatCents(total)}</span>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create Invoice"}
        </button>
      </div>
    </div>
  );
}
