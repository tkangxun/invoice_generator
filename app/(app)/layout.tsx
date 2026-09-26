import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logout, switchCompany } from "@/lib/actions/auth";
import { createAccount } from "@/lib/account";
import { AppNav } from "@/components/AppNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const held = await createAccount(prisma).companiesFor(user.userId);

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav
        name={user.name}
        isAdmin={user.role === "ADMIN"}
        companyName={user.companyName}
        companyCode={user.companyCode}
        currentCompanyId={user.companyId}
        companies={held}
        switchCompanyAction={switchCompany}
        logoutAction={logout}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
