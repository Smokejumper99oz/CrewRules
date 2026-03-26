"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plane,
  Users,
  GraduationCap,
  CreditCard,
  DollarSign,
  Upload,
  Activity,
  Sparkles,
  Award,
  HeartPulse,
  FileText,
  Inbox,
  List,
  ToggleLeft,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const linkBase =
  "block rounded-lg px-3 py-2 text-sm transition touch-manipulation";
const activeLink = "font-medium text-slate-200 bg-slate-800/60 border border-slate-600/40";
const inactiveLink = "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200";
const comingSoon = "text-slate-500 cursor-default opacity-75";

function NavItem({
  href,
  label,
  icon: Icon,
  isComingSoon,
  isActive,
}: {
  href?: string;
  label: string;
  icon: LucideIcon;
  isComingSoon?: boolean;
  isActive?: boolean;
}) {
  if (isComingSoon) {
    return (
      <span className={`${linkBase} ${comingSoon} flex items-center gap-2`}>
        <Icon className="h-4 w-4 shrink-0" />
        <span>
          {label} <span className="ml-1.5 text-xs text-slate-500">(soon)</span>
        </span>
      </span>
    );
  }
  return (
    <Link
      href={href!}
      className={`${linkBase} ${isActive ? activeLink : inactiveLink} flex items-center gap-2`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function SuperAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      <div>
        <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Overview
        </div>
        <div className="space-y-0.5">
          <NavItem href="/super-admin" label="Dashboard" icon={LayoutDashboard} isActive={pathname === "/super-admin"} />
          <NavItem label="Tenants" icon={Plane} isComingSoon />
          <NavItem href="/super-admin/users" label="Users" icon={Users} isActive={pathname?.startsWith("/super-admin/users")} />
          <NavItem
            href="/super-admin/founding-members"
            label="Founding Members"
            icon={Award}
            isActive={pathname?.startsWith("/super-admin/founding-members")}
          />
          <NavItem label="Subscriptions" icon={CreditCard} isComingSoon />
          <NavItem label="Revenue" icon={DollarSign} isComingSoon />
        </div>
      </div>

      <div className="border-t border-slate-800 my-3">
        <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Platform
        </div>
        <div className="space-y-0.5">
          <NavItem label="Imports" icon={Upload} isComingSoon />
          <NavItem label="API Usage" icon={Activity} isComingSoon />
          <NavItem label="AI / Search" icon={Sparkles} isComingSoon />
          <NavItem
            href="/super-admin/system-health"
            label="System Health"
            icon={HeartPulse}
            isActive={pathname?.startsWith("/super-admin/system-health")}
          />
          <NavItem label="Audit Log" icon={FileText} isComingSoon />
        </div>
      </div>

      <div className="border-t border-slate-800 my-3">
        <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Admin Tools
        </div>
        <div className="space-y-0.5">
          <NavItem label="Access Requests" icon={Inbox} isComingSoon />
          <Link
            href="/super-admin/waitlist"
            className={`${linkBase} ${pathname?.startsWith("/super-admin/waitlist") ? activeLink : inactiveLink} flex items-center gap-2`}
          >
            <List className="h-4 w-4 shrink-0" />
            Waitlist
          </Link>
          <NavItem
            href="/super-admin/mentoring"
            label="Mentoring"
            icon={GraduationCap}
            isActive={pathname?.startsWith("/super-admin/mentoring")}
          />
          <NavItem label="Feature Flags" icon={ToggleLeft} isComingSoon />
          <NavItem label="Admin Settings" icon={Settings} isComingSoon />
        </div>
      </div>
    </nav>
  );
}
