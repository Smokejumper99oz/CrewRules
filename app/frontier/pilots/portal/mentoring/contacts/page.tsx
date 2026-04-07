import Image from "next/image";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Users, Shield, DollarSign, Phone, Mail, BookUser, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const ICON_MAP: Record<string, React.ElementType> = {
  users:   Users,
  shield:  Shield,
  dollar:  DollarSign,
  phone:   Phone,
  mail:    Mail,
  book:    BookUser,
};

type ContactEntry = {
  label: string;
  value: string;
  href?: string;
};

type ContactCard = {
  id: string;
  title: string;
  subtitle: string;
  icon_key: string;
  sort_order: number;
  entries: ContactEntry[];
};

const CARD_CLASS =
  "rounded-2xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] overflow-hidden";

export default async function ImportantContactsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/frontier/pilots/login?error=not_signed_in");

  const supabase = await createClient();
  const { data } = await supabase
    .from("mentoring_contacts")
    .select("id, title, subtitle, icon_key, sort_order, entries")
    .eq("tenant", profile.tenant ?? "frontier")
    .eq("portal", profile.portal ?? "pilots")
    .order("sort_order", { ascending: true });

  const cards: ContactCard[] = (data ?? []).map((row) => ({
    id:         row.id,
    title:      row.title,
    subtitle:   row.subtitle ?? "",
    icon_key:   row.icon_key ?? "users",
    sort_order: row.sort_order ?? 0,
    entries:    Array.isArray(row.entries) ? (row.entries as ContactEntry[]) : [],
  }));

  return (
    <div className="space-y-6">
      {/* ALPA Frontier MEC branded header */}
      <div className="rounded-2xl border border-white/5 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-950/80 px-5 py-4 flex items-center gap-4">
        <Image
          src="/logo/ALPA_Frontier_master_logo.png.png"
          alt="Frontier Master Executive Council — ALPA"
          width={72}
          height={72}
          className="shrink-0 drop-shadow-md"
          priority
        />
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-0.5">
            Air Line Pilots Association, International
          </div>
          <h1 className="text-base font-bold text-slate-100 leading-snug">
            Frontier Master Executive Council
          </h1>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Your ALPA contacts for the NH Mentorship Program, Military Affairs, and pilot support resources.
          </p>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 px-6 py-10 text-center">
          <BookUser className="mx-auto h-8 w-8 text-slate-600 mb-3" aria-hidden />
          <p className="text-sm text-slate-500">No contacts have been added yet.</p>
          <p className="text-xs text-slate-600 mt-1">Your admin can add contacts from the Admin Mentoring page.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => {
            const Icon = ICON_MAP[card.icon_key] ?? Users;
            return (
              <div key={card.id} className={CARD_CLASS}>
                <div className="flex items-start gap-3 px-5 py-4 border-b border-white/5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 ring-1 ring-white/10">
                    <Icon className="h-4 w-4 text-emerald-400" aria-hidden />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{card.title}</div>
                    {card.subtitle && (
                      <div className="text-xs text-slate-500 mt-0.5">{card.subtitle}</div>
                    )}
                  </div>
                </div>

                {card.entries.length > 0 && (
                  <div className="px-5 py-4 space-y-3">
                    {card.entries.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between gap-4">
                        <span className="text-xs text-slate-500 shrink-0">{entry.label}</span>
                        {entry.href ? (
                          <a
                            href={entry.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition font-medium text-right"
                          >
                            {entry.value}
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-sm text-slate-300 font-medium text-right">{entry.value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-600 text-center pt-2">
        Contact information is maintained by your ALPA local admin. Reach out to your union rep if any details need updating.
      </p>
    </div>
  );
}
