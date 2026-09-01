import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  createItem,
  deleteItem,
  moveItem,
  updateItem,
  toggleItemActive,
} from "@/lib/actions/admin";
import { PriceListCsvCard } from "@/components/PriceListCsvCard";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ITEM_ORDER_BY } from "@/lib/item-order";

const inputCls =
  "w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

export default async function AdminItemsPage() {
  await requireAdmin();

  const items = await prisma.item.findMany({
    orderBy: ITEM_ORDER_BY,
    include: { _count: { select: { lines: true } } },
  });

  return (
    <div>
      <h1 className="text-xl font-bold">Price List</h1>
      <p className="mt-1 text-sm text-gray-500">
        Changes apply to new invoices immediately. Existing invoices keep the
        prices they were created with. Use Up and Down to set the order of the
        item dropdown on new invoices. Disable an item to hide it from new
        invoices, or delete it to remove it from this list. Deleted items stay
        on old invoices as copied line text.
      </p>

      <PriceListCsvCard />

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Add item</h2>
        <form
          action={createItem}
          className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-12"
        >
          <label className="block text-xs font-medium text-gray-500 sm:col-span-4">
            Name *
            <input name="name" required className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-medium text-gray-500 sm:col-span-2">
            Price (S$) *
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block text-xs font-medium text-gray-500 sm:col-span-2">
            Type
            <select name="type" className={`mt-1 ${inputCls}`}>
              <option value="service">Service</option>
              <option value="supplement">Supplement</option>
              <option value="package">Package</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-500 sm:col-span-3">
            Includes (packages only)
            <input
              name="includes"
              placeholder="e.g. 1x HBOT, 1x Red Light Therapy"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <div className="sm:col-span-1">
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`rounded-xl border bg-white p-4 shadow-sm ${
              item.active ? "border-gray-200" : "border-gray-200 opacity-60"
            }`}
          >
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
              <form
                id={`item-${item.id}`}
                action={updateItem.bind(null, item.id)}
                className="contents"
              >
                <label className="block text-xs font-medium text-gray-500 sm:col-span-4">
                  Name
                  <input
                    name="name"
                    defaultValue={item.name}
                    required
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500 sm:col-span-2">
                  Price (S$)
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={(item.priceCents / 100).toFixed(2)}
                    required
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500 sm:col-span-2">
                  Type
                  <select
                    name="type"
                    defaultValue={item.type}
                    className={`mt-1 ${inputCls}`}
                  >
                    <option value="service">Service</option>
                    <option value="supplement">Supplement</option>
                    <option value="package">Package</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-500 sm:col-span-4">
                  Includes
                  <input
                    name="includes"
                    defaultValue={item.includes ?? ""}
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
              </form>
              <div className="flex flex-wrap gap-2 sm:col-span-12">
                <form action={moveItem.bind(null, item.id, "up")}>
                  <button
                    type="submit"
                    disabled={index === 0}
                    aria-label={`Move ${item.name} up`}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Up
                  </button>
                </form>
                <form action={moveItem.bind(null, item.id, "down")}>
                  <button
                    type="submit"
                    disabled={index === items.length - 1}
                    aria-label={`Move ${item.name} down`}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Down
                  </button>
                </form>
                <button
                  type="submit"
                  form={`item-${item.id}`}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Save
                </button>
                <form action={toggleItemActive.bind(null, item.id)}>
                  <button
                    type="submit"
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      item.active
                        ? "border border-red-200 text-red-600 hover:bg-red-50"
                        : "border border-green-200 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {item.active ? "Disable" : "Enable"}
                  </button>
                </form>
                <form action={deleteItem.bind(null, item.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={
                      item._count.lines > 0
                        ? `Delete ${item.name}? It is on ${item._count.lines} invoice line${
                            item._count.lines === 1 ? "" : "s"
                          }. Those invoices keep their descriptions and prices. This cannot be undone.`
                        : `Delete ${item.name} from the price list? This cannot be undone.`
                    }
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </div>
            </div>
            {!item.active && (
              <div className="mt-2 text-xs text-gray-500">
                Disabled — not selectable on new invoices
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
