import Link from "next/link";
import type { ReactNode } from "react";
import { NO_INVOICE_PROFILE } from "@/lib/invoice-list";
import type { CompanyProfileSummary } from "@/lib/company";

export function ProfileFilterBar({
  profiles,
  profile,
  description,
  hrefFor,
}: {
  profiles: CompanyProfileSummary[];
  profile: string;
  description: string;
  hrefFor: (profile?: string) => string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-800">Profile</div>
      <p className="mt-0.5 text-sm text-gray-500">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ProfileFilterLink href={hrefFor()} active={!profile}>
          All profiles
        </ProfileFilterLink>
        {profiles.map((item) => (
          <ProfileFilterLink
            key={item.id}
            href={hrefFor(item.id)}
            active={profile === item.id}
          >
            {item.name}
            {item.active ? " · main" : ""}
          </ProfileFilterLink>
        ))}
        <ProfileFilterLink
          href={hrefFor(NO_INVOICE_PROFILE)}
          active={profile === NO_INVOICE_PROFILE}
        >
          No profile
        </ProfileFilterLink>
      </div>
    </div>
  );
}

function ProfileFilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${
        active
          ? "bg-blue-600 text-white"
          : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </Link>
  );
}
