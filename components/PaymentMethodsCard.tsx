import {
  createPaymentMethod,
  deletePaymentMethod,
  togglePaymentMethod,
} from "@/lib/actions/admin";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export function PaymentMethodsCard({
  methods,
}: {
  methods: { id: string; name: string; active: boolean }[];
}) {
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Payment methods</h2>
      <p className="mt-1 text-sm text-gray-500">
        These options appear when recording a payment. Add custom methods for
        admin and sales use.
      </p>
      <form
        action={createPaymentMethod}
        className="mt-4 flex flex-wrap items-end gap-2"
      >
        <label className="min-w-[12rem] flex-1 text-sm font-medium text-gray-700">
          New method
          <input
            name="name"
            required
            placeholder="e.g. GrabPay"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Add
        </button>
      </form>
      <ul className="mt-4 divide-y divide-gray-100">
        {methods.map((method) => (
          <li
            key={method.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div>
              <span className="font-medium">{method.name}</span>
              {!method.active && (
                <span className="ml-2 text-xs text-gray-400">(disabled)</span>
              )}
            </div>
            <div className="flex gap-2">
              <form action={togglePaymentMethod.bind(null, method.id)}>
                <button
                  type="submit"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                >
                  {method.active ? "Disable" : "Enable"}
                </button>
              </form>
              <form action={deletePaymentMethod.bind(null, method.id)}>
                <ConfirmSubmitButton
                  confirmMessage={`Delete payment method ${method.name}? Existing payments keep this name.`}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
            </div>
          </li>
        ))}
        {methods.length === 0 && (
          <li className="py-4 text-sm text-gray-500">
            No methods yet. Add one above. Defaults are used until then.
          </li>
        )}
      </ul>
    </div>
  );
}
