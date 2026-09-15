"use client";

import { useState } from "react";
import { deleteCompany, updateCompany } from "@/lib/actions/admin";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { normalizeCompanyCode } from "@/lib/company-code";

const inputCls =
  "w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

export type HeldCompany = {
  id: string;
  code: string;
  name: string;
  invoiceCount: number;
  receiptCount: number;
};

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function HeldCompaniesCard({
  companies,
  currentCompanyId,
  error,
  deleted,
}: {
  companies: HeldCompany[];
  currentCompanyId: string;
  error?: string;
  deleted?: boolean;
}) {
  const canDelete = companies.length > 1;
  const fallbackName =
    companies.find((company) => company.id !== currentCompanyId)?.name ??
    "another company";

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Companies I hold</h2>
      <p className="mt-1 text-sm text-gray-500">
        Rename a company here. Company ID is generated from the name and
        updates when you rename. Deleting a company removes its invoices,
        receipts, price list, and access. Letterhead is under Invoice settings
        for the company you are signed into.
      </p>
      {deleted && (
        <p className="mt-3 text-sm text-green-700">Company deleted.</p>
      )}
      {error === "last-company" && (
        <p className="mt-3 text-sm text-red-600">
          Keep at least one company in the app.
        </p>
      )}
      {error === "last-held" && (
        <p className="mt-3 text-sm text-red-600">
          Keep at least one company you can sign into.
        </p>
      )}
      <ul className="mt-4 divide-y divide-gray-100">
        {companies.map((company) => {
          const isCurrent = company.id === currentCompanyId;
          return (
            <li key={company.id} className="py-3">
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
                <form
                  id={`company-${company.id}`}
                  action={updateCompany.bind(null, company.id)}
                  className="contents"
                >
                  <CompanyNameField
                    defaultName={company.name}
                    currentCode={company.code}
                  />
                </form>
                <div className="flex flex-wrap items-center gap-2 sm:col-span-5">
                  <button
                    type="submit"
                    form={`company-${company.id}`}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    Save
                  </button>
                  {canDelete ? (
                    <form action={deleteCompany.bind(null, company.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={
                          isCurrent
                            ? `Delete ${company.name}? This removes ${countLabel(
                                company.invoiceCount,
                                "invoice",
                                "invoices"
                              )}, ${countLabel(
                                company.receiptCount,
                                "receipt",
                                "receipts"
                              )}, the price list, and all access. You will be switched to ${fallbackName}.`
                            : `Delete ${company.name}? This removes ${countLabel(
                                company.invoiceCount,
                                "invoice",
                                "invoices"
                              )}, ${countLabel(
                                company.receiptCount,
                                "receipt",
                                "receipts"
                              )}, the price list, and all access.`
                        }
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                  {isCurrent && (
                    <span className="text-xs font-semibold text-green-700">
                      Current
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CompanyNameField({
  defaultName,
  currentCode,
}: {
  defaultName: string;
  currentCode: string;
}) {
  const [name, setName] = useState(defaultName);
  const previewCode = normalizeCompanyCode(name) || currentCode;

  return (
    <label className="block text-xs font-medium text-gray-500 sm:col-span-7">
      Name
      <input
        name="name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={`mt-1 ${inputCls}`}
      />
      <span className="mt-1 block text-xs font-normal text-gray-400">
        Company ID: {previewCode}
      </span>
    </label>
  );
}
