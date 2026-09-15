"use client";

import { useId } from "react";

export type SwitchableCompany = {
  id: string;
  name: string;
  code: string;
};

export function CompanySwitcher({
  companies,
  currentCompanyId,
  switchAction,
}: {
  companies: SwitchableCompany[];
  currentCompanyId: string;
  switchAction: (formData: FormData) => Promise<void>;
}) {
  const selectId = useId();
  if (companies.length < 2) return null;

  return (
    <form action={switchAction}>
      <label className="sr-only" htmlFor={selectId}>
        Switch company
      </label>
      <select
        id={selectId}
        key={currentCompanyId}
        name="companyId"
        defaultValue={currentCompanyId}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="max-w-[11rem] truncate rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:border-gray-300 focus:border-blue-500 focus:outline-none sm:max-w-[14rem]"
      >
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </form>
  );
}
