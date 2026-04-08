"use client";

import { useActionState } from "react";
import { CheckCircle2, UserPlus, Info } from "lucide-react";
import { createInvitedUser, type CreateUserState } from "@/app/super-admin/create-user/actions";
import { TENANT_CONFIG } from "@/lib/tenant-config";

const TENANT_OPTIONS = Object.entries(TENANT_CONFIG).map(([key, cfg]) => ({
  value: key,
  label: cfg.displayName,
}));

const PORTAL_OPTIONS = [
  { value: "pilots", label: "Pilot Portal" },
  { value: "flight-attendants", label: "Flight Attendant Portal" },
];

const ROLE_OPTIONS = [
  { value: "tenant_admin", label: "Admin (tenant_admin) — admin portal only, any email" },
  { value: "pilot", label: "Pilot — standard pilot portal access" },
  { value: "flight_attendant", label: "Flight Attendant — FA portal access" },
];

const initial: CreateUserState = null;

export function CreateUserForm() {
  const [state, action, isPending] = useActionState(createInvitedUser, initial);

  return (
    <div className="max-w-xl space-y-6">
      {state?.ok && (
        <div className="flex items-start gap-3 rounded-xl border border-[#75C043]/30 bg-[#75C043]/10 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-[#75C043] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#75C043]">Invite sent successfully</p>
            <p className="text-xs text-slate-400 mt-0.5">
              An invitation email was sent to <strong>{state.invitedEmail}</strong>. They will
              click the link and set their own password before their first sign-in.
            </p>
          </div>
        </div>
      )}

      {state?.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">{state.error}</p>
        </div>
      )}

      <form action={action} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1.5">
            Email address <span className="text-red-400">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            disabled={isPending}
            placeholder="e.g. john.smith@alpa.org or personal@gmail.com"
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#75C043]/50 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-slate-500">
            Any email — not restricted to the airline domain. An invite link will be sent here.
          </p>
        </div>

        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1.5">
            Full name <span className="text-slate-500">(optional)</span>
          </label>
          <input
            name="full_name"
            type="text"
            disabled={isPending}
            placeholder="e.g. Justin Miller"
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#75C043]/50 disabled:opacity-50"
          />
        </div>

        {/* Tenant */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1.5">
            Airline / Tenant <span className="text-red-400">*</span>
          </label>
          <select
            name="tenant"
            required
            disabled={isPending}
            defaultValue="frontier"
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white outline-none focus:border-[#75C043]/50 disabled:opacity-50"
          >
            {TENANT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Portal */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1.5">
            Portal <span className="text-red-400">*</span>
          </label>
          <select
            name="portal"
            required
            disabled={isPending}
            defaultValue="pilots"
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white outline-none focus:border-[#75C043]/50 disabled:opacity-50"
          >
            {PORTAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1.5">
            Role <span className="text-red-400">*</span>
          </label>
          <select
            name="role"
            required
            disabled={isPending}
            defaultValue="tenant_admin"
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white outline-none focus:border-[#75C043]/50 disabled:opacity-50"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-400 leading-relaxed space-y-1">
            <p>
              <strong className="text-slate-300">Admin role:</strong> Signs in with any email,
              lands directly on the Admin Dashboard. No pilot portal access or back-link shown.
            </p>
            <p>
              <strong className="text-slate-300">Invite flow:</strong> The user receives an email,
              clicks the link, and sets their own password. No temporary password is sent.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-[#75C043] px-5 py-2.5 text-sm font-semibold text-slate-950 hover:brightness-110 transition disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          {isPending ? "Sending invite…" : "Send Invite"}
        </button>
      </form>
    </div>
  );
}
