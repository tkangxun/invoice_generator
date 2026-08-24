import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { createItem, updateItem, toggleItemActive } from "@/lib/actions/admin";

const inputCls =
  "w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

export default async function AdminItemsPage() {
  await requireAdmin();

  const items = await prisma.item.findMany({
    orderBy: [{ active: "desc" }, { type: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <h1 className="text-xl font-bold">Price List</h1>
      <p className="mt-1 text-sm text-gray-500">
        Changes apply to new invoices immediately. Existing invoices keep the
        prices they were created with. Disabled items stay on old invoices but
        can&apos;t be added to new ones.
      </p>

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
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl border bg-white p-4 shadow-sm ${
              item.active ? "border-gray-200" : "border-gray-200 opacity-60"
            }`}
          >
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
              <form
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
                <label className="block text-xs font-medium text-gray-500 sm:col-span-2">
                  Includes
                  <input
                    name="includes"
                    defaultValue={item.includes ?? ""}
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <div className="sm:col-span-1">
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    Save
                  </button>
                </div>
              </form>
              <form action={toggleItemActive.bind(null, item.id)} className="sm:col-span-1">
                <button
                  type="submit"
                  className={`w-full rounded-lg px-3 py-2 text-sm font-medium ${
                    item.active
                      ? "border border-red-200 text-red-600 hover:bg-red-50"
                      : "border border-green-200 text-green-700 hover:bg-green-50"
                  }`}
                >
                  {item.active ? "Disable" : "Enable"}
                </button>
              </form>
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
