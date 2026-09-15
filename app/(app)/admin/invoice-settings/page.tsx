import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ensureCompanyDefaults, getCompany } from "@/lib/company";
import { InvoiceSettingsForm } from "@/components/InvoiceSettingsForm";
import { PaymentMethodsCard } from "@/components/PaymentMethodsCard";

export default async function InvoiceSettingsPage() {
  const admin = await requireAdmin();
  await ensureCompanyDefaults(admin.companyId);
  const [company, methods] = await Promise.all([
    getCompany(admin.companyId),
    prisma.paymentMethod.findMany({
      where: { companyId: admin.companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">Invoice settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Letterhead and payment methods for {company.name}. Sales invoices in
        this company use these details. Company ID for login is{" "}
        <span className="font-medium text-gray-700">{company.code}</span>.
      </p>
      <div className="mt-6">
        <InvoiceSettingsForm key={company.id} company={company} />
      </div>
      <PaymentMethodsCard methods={methods} />
    </div>
  );
}
