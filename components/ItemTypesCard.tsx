import {
  createItemType,
  deleteItemType,
  updateItemType,
} from "@/lib/actions/admin";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import type { ItemTypeInfo } from "@/lib/item-types";

const inputCls =
  "w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

export function ItemTypesCard({
  types,
  itemCounts,
  error,
}: {
  types: ItemTypeInfo[];
  itemCounts: Record<string, number>;
  error?: string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Item types</h2>
      <p className="mt-1 text-sm text-gray-500">
        Categories on the price list and new invoices. Rename them, add your
        own, or delete unused ones. Collection types can hold leftover qty as
        credit. Includes is for packages.
      </p>
      {error === "last" && (
        <p className="mt-3 text-sm text-red-600">
          Keep at least one item type.
        </p>
      )}
      <form
        action={createItemType}
        className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-12"
      >
        <label className="block text-xs font-medium text-gray-500 sm:col-span-4">
          Name *
          <input
            name="name"
            required
            placeholder="e.g. Rental"
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <label className="block text-xs font-medium text-gray-500 sm:col-span-3">
          Qty unit
          <input
            name="unitPlural"
            placeholder="sessions"
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 sm:pb-2">
          <input type="checkbox" name="tracksCollection" className="rounded" />
          Collection
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 sm:pb-2">
          <input type="checkbox" name="hasIncludes" className="rounded" />
          Includes
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
      <ul className="mt-4 divide-y divide-gray-100">
        {types.map((type) => {
          const used = itemCounts[type.slug] ?? 0;
          const fallbackName =
            types.find((row) => row.id !== type.id)?.name ?? "another type";
          return (
            <li key={type.id} className="py-3">
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
                <form
                  id={`type-${type.id}`}
                  action={updateItemType.bind(null, type.id)}
                  className="contents"
                >
                  <label className="block text-xs font-medium text-gray-500 sm:col-span-3">
                    Name
                    <input
                      name="name"
                      required
                      defaultValue={type.name}
                      className={`mt-1 ${inputCls}`}
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-500 sm:col-span-2">
                    Qty unit
                    <input
                      name="unitPlural"
                      defaultValue={type.unitPlural}
                      className={`mt-1 ${inputCls}`}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 sm:pb-2">
                    <input
                      type="checkbox"
                      name="tracksCollection"
                      defaultChecked={type.tracksCollection}
                      className="rounded"
                    />
                    Collection
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 sm:pb-2">
                    <input
                      type="checkbox"
                      name="hasIncludes"
                      defaultChecked={type.hasIncludes}
                      className="rounded"
                    />
                    Includes
                  </label>
                </form>
                <div className="flex flex-wrap gap-2 sm:col-span-3">
                  <button
                    type="submit"
                    form={`type-${type.id}`}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    Save
                  </button>
                  <form action={deleteItemType.bind(null, type.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={
                        used > 0
                          ? `Delete ${type.name}? ${used} item${
                              used === 1 ? "" : "s"
                            } will move to ${fallbackName}.`
                          : `Delete item type ${type.name}?`
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                CSV type: {type.slug}
                {used ? ` · ${used} item${used === 1 ? "" : "s"}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
