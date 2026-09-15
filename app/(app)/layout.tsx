import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logout, switchCompany } from "@/lib/actions/auth";
import { AppNav } from "@/components/AppNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const held = await prisma.companyMembership.findMany({
    where: { userId: user.userId },
    orderBy: { company: { name: "asc" } },
    select: {
      company: { select: { id: true, name: true, code: true } },
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav
        name={user.name}
        isAdmin={user.role === "ADMIN"}
        companyName={user.companyName}
        companyCode={user.companyCode}
        currentCompanyId={user.companyId}
        companies={held.map((row) => row.company)}
        switchCompanyAction={switchCompany}
        logoutAction={logout}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
