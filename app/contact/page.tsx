"use client";

import Link from "next/link";
import { useState } from "react";
import TimeContextBlock from "@/components/time-context-block";

export default function ContactPage() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const { companyWebsite, ...payload } = data as Record<string, string>;
    if (companyWebsite) return; // honeypot

    setError(null);
    setSuccess(false);
    setIsPending(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        setSuccess(false);
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
      form.reset();
    } catch {
      setSuccess(false);
      setError("Failed to send message. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <h1 className="text-3xl font-bold tracking-tight">
            Contact Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-xs text-white">™</span>
          </h1>
          <p className="mt-2 text-slate-400">
            Questions, demos, or partnership inquiries — we&apos;re here to help.
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
                <option value="General Inquiry">General Inquiry</option>
                <option value="Product Demo Request">Product Demo Request</option>
                <option value="Technical Support">Technical Support</option>
                <option value="Billing & Subscription">Billing & Subscription</option>
                <option value="Enterprise / Team Plans">Enterprise / Team Plans</option>
                <option value="Partnership Opportunities">Partnership Opportunities</option>
                <option value="ALPA / Union Collaboration">ALPA / Union Collaboration</option>
                <option value="Media / Press Inquiry">Media / Press Inquiry</option>
                <option value="Feedback & Feature Request">Feedback & Feature Request</option>
                <option value="Other">Other</option>
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
                Message sent. We&apos;ll get back to you soon.
              </p>
            )}
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 px-6 py-3 rounded-xl bg-[#75C043] text-slate-950 font-semibold hover:brightness-110 transition disabled:opacity-50"
            >
              {isPending ? "Sending…" : "Send Message"}
            </button>
          </form>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <h2 className="text-xl font-bold tracking-tight text-white">
            Crew<span className="text-[#75C043]">Rules</span>
            <span className="align-super text-xs text-white">™</span>
            <span className="text-white">
              {" "}
              — The Smart Platform for Airline Crew
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            A product of{" "}
            <a
              href="https://www.marvellagroup.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 underline decoration-slate-500 underline-offset-2 hover:text-white"
            >
              Marvella Group LLC
            </a>
          </p>

          <div className="mt-6 space-y-5 text-slate-300">
            <div className="flex gap-3">
              <span className="shrink-0 text-lg leading-snug" aria-hidden>
                🕒
              </span>
              <div className="text-sm leading-relaxed">
                <p className="font-semibold text-white">Business Hours</p>
                <p>Monday – Friday: 09:00 - 17:00 (ET)</p>
                <p className="mt-1">Closed Weekends and Holidays</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 text-lg leading-snug" aria-hidden>
                📍
              </span>
              <address className="not-italic text-sm leading-relaxed">
                <p className="font-semibold text-white">1901 Ulmerton Rd, Suite 625-311</p>
                <p>Clearwater, FL 33762</p>
              </address>
            </div>
            <div className="text-sm text-slate-300">
              <a href="tel:+17272480998" className="hover:text-white transition">
                📞 +1 (727) 248-0998
              </a>
            </div>

            <TimeContextBlock />
          </div>

          <p className="mt-6 text-sm text-slate-400">We typically respond within 24 hours.</p>
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
