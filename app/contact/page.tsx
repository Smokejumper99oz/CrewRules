"use client";

import Link from "next/link";
import { useState } from "react";

export default function ContactPage() {
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    console.log("Contact form data:", data);

    setSuccess(true);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <h1 className="text-3xl font-bold tracking-tight">
            Contact Crew<span className="text-[#75C043]">Rules</span>
          </h1>
          <p className="mt-2 text-slate-400">
            Questions, demos, or partnership inquiries.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm text-slate-300">Name <span className="text-slate-500">(required)</span></span>
              <input
                name="name"
                type="text"
                required
                className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Your name"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">Email <span className="text-slate-500">(required)</span></span>
              <input
                name="email"
                type="email"
                required
                className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="you@company.com"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">Subject</span>
              <select
                name="subject"
                className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="General">General</option>
                <option value="Support">Support</option>
                <option value="ALPA Demo">ALPA Demo</option>
                <option value="Partnership">Partnership</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">Message <span className="text-slate-500">(required)</span></span>
              <textarea
                name="message"
                required
                rows={4}
                className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                placeholder="Your message..."
              />
            </label>

            <input
              type="text"
              name="companyWebsite"
              tabIndex={-1}
              autoComplete="off"
              className="absolute -left-[9999px]"
              aria-hidden="true"
            />

            {success && (
              <p className="text-sm text-emerald-400">
                Message sent (test mode)
              </p>
            )}

            <button
              type="submit"
              className="w-full mt-2 px-6 py-3 rounded-xl bg-[#75C043] text-slate-950 font-semibold hover:brightness-110 transition disabled:opacity-50"
            >
              Send Message
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-slate-300 hover:text-white underline underline-offset-4"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
