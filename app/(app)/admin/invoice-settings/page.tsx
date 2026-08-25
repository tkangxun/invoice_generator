import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  ensureInvoiceSettings,
  getCompany,
  listCompanyProfiles,
} from "@/lib/company";
import { InvoiceSettingsForm } from "@/components/InvoiceSettingsForm";
import { PaymentMethodsCard } from "@/components/PaymentMethodsCard";

export default async function InvoiceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  await requireAdmin();
  await ensureInvoiceSettings();
  const { profile } = await searchParams;
  const [company, profiles, methods] = await Promise.all([
    getCompany(profile),
    listCompanyProfiles(),
    prisma.paymentMethod.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">Invoice settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Company identity on invoices. The main profile is what sales invoices
        use. Admins can create invoices from other saved profiles.
      </p>
      <div className="mt-6">
        <InvoiceSettingsForm
          key={company.id}
          company={company}
          profiles={profiles}
        />
      </div>
      <PaymentMethodsCard methods={methods} />
    </div>
  );
}
