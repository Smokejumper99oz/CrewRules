"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUsPhoneDisplay } from "@/lib/format-us-phone";
import { updateAdminProfileBasics } from "./actions";

export function AdminProfileBasicsForm({
  fullNameDefault,
  phoneDisplayDefault,
}: {
  fullNameDefault: string;
  phoneDisplayDefault: string;
}) {
  const router = useRouter();
  const [phoneValue, setPhoneValue] = useState(phoneDisplayDefault);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const result = await updateAdminProfileBasics(fd);
    setPending(false);
    if ("error" in result && result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Saved." });
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200"
    >
      <h2 className="text-lg font-semibold tracking-tight border-b border-slate-200 pb-2 text-[#1a2b4b]">
        Account basics
      </h2>
      <p className="mt-3 text-sm text-slate-600">
        Your name and phone are stored on your CrewRules profile and may appear in admin or crew-facing
        features where applicable.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="admin-profile-full-name" className="block text-xs font-medium text-slate-600">
            Full Name
          </label>
          <input
            id="admin-profile-full-name"
            name="full_name"
            type="text"
            autoComplete="name"
            defaultValue={fullNameDefault}
            disabled={pending}
            className="mt-2 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-600/20"
            placeholder="Your full name"
          />
          <p className="mt-1 text-xs text-slate-500">
            If you have not saved a name yet, we suggest one from your email — you can edit it before saving.
          </p>
        </div>

        <div>
          <label htmlFor="admin-profile-phone" className="block text-xs font-medium text-slate-600">
            Phone Number
          </label>
          <input
            id="admin-profile-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phoneValue}
            onChange={(e) => setPhoneValue(formatUsPhoneDisplay(e.target.value))}
            disabled={pending}
            className="mt-2 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-600/20"
            placeholder="(XXX) XXX-XXXX"
          />
        </div>
      </div>

      {message && (
        <p
          className={`mt-4 text-sm font-medium ${message.type === "success" ? "text-emerald-800" : "text-red-700"}`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
