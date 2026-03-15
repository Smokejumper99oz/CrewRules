import Link from "next/link";

const linkBase =
  "block rounded-lg px-3 py-2 text-sm transition touch-manipulation";
const activeLink = "font-medium text-slate-200 bg-slate-800/80 border border-slate-600/50";
const inactiveLink = "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200";
const comingSoon = "text-slate-500 cursor-default opacity-75";

function NavItem({
  href,
  label,
  isComingSoon,
}: {
  href?: string;
  label: string;
  isComingSoon?: boolean;
}) {
  if (isComingSoon) {
    return (
      <span className={`${linkBase} ${comingSoon}`}>
        {label}
        <span className="ml-1.5 text-xs text-slate-500">(soon)</span>
      </span>
    );
  }
  return (
    <Link
      href={href!}
      className={`${linkBase} ${inactiveLink}`}
    >
      {label}
    </Link>
  );
}

export function SuperAdminNav() {
  return (
    <nav className="space-y-6">
      <div>
        <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Overview
        </div>
        <div className="space-y-0.5">
          <Link href="/super-admin" className={`${linkBase} ${activeLink}`}>
            Dashboard
          </Link>
          <NavItem label="Tenants" isComingSoon />
          <NavItem label="Users" isComingSoon />
          <NavItem label="Subscriptions" isComingSoon />
          <NavItem label="Revenue" isComingSoon />
        </div>
      </div>

      <div>
        <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Platform
        </div>
        <div className="space-y-0.5">
          <NavItem label="Imports" isComingSoon />
          <NavItem label="API Usage" isComingSoon />
          <NavItem label="AI / Search" isComingSoon />
          <NavItem label="System Health" isComingSoon />
          <NavItem label="Audit Log" isComingSoon />
        </div>
      </div>

      <div>
        <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Owner Tools
        </div>
        <div className="space-y-0.5">
          <NavItem label="Access Requests" isComingSoon />
          <Link
            href="/frontier/pilots/admin/waitlist"
            className={`${linkBase} ${inactiveLink}`}
          >
            Waitlist
          </Link>
          <NavItem label="Feature Flags" isComingSoon />
          <NavItem label="Admin Settings" isComingSoon />
        </div>
      </div>
    </nav>
  );
}
