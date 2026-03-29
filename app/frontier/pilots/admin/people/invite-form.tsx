"use client";

import { useState } from "react";
import { inviteUser } from "./actions";

export function InviteUserForm({ className }: { className?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const result = await inviteUser(fd);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      form.reset();
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex flex-wrap items-end gap-4 md:flex-nowrap">
        <label className="flex w-full min-w-0 flex-col gap-1 md:w-2/5 md:max-w-md">
          <span className="text-xs text-slate-400">Email</span>
          <input
            type="email"
            name="email"
            required
            placeholder="firstname.lastname@flyfrontier.com"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Role</span>
          <select
            name="role"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/50"
          >
            <option value="pilot">Pilot</option>
            <option value="flight_attendant">Flight Attendant</option>
            <option value="tenant_admin">Tenant Admin</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Portal</span>
          <select
            name="portal"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/50"
          >
            <option value="pilots">Pilots</option>
            <option value="fa">Flight Attendants</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#75C043] px-4 py-2 text-sm font-medium text-slate-950 hover:bg-[#75C043]/90 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Invite"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
      {success && <p className="mt-2 text-sm text-emerald-400">Invitation sent.</p>}
    </form>
  );
}
