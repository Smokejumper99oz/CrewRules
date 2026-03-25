const CARD_CLASS =
  "rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";

function digitsForTel(value: string): string {
  const t = value.trim();
  if (!t) return "";
  if (t.startsWith("+")) {
    return "+" + t.slice(1).replace(/\D/g, "");
  }
  return t.replace(/\D/g, "");
}

export type MentorContactCardProps = {
  fullName: string;
  /** Preferred mentor contact email only (never login email). */
  contactEmail: string | null | undefined;
  /** Display phone (mentor_phone or profile phone). */
  phone: string | null | undefined;
  /** When set, omit outer card chrome (parent already provides rounded border). */
  variant?: "standalone" | "embedded";
};

/**
 * Mentee-facing card: mentor name, optional email/phone rows, Call / Email actions.
 */
export function MentorContactCard({
  fullName,
  contactEmail,
  phone,
  variant = "standalone",
}: MentorContactCardProps) {
  const email = contactEmail?.trim() || "";
  const phoneRaw = phone?.trim() || "";
  const telHref = phoneRaw ? `tel:${digitsForTel(phoneRaw)}` : "";
  const mailHref = email ? `mailto:${encodeURIComponent(email)}` : "";

  const inner = (
    <>
      <h2 className="text-base font-semibold text-white border-b border-white/5 pb-3">Mentor</h2>
      <p className="mt-4 text-lg font-semibold text-white leading-snug break-words">{fullName}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {email ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
            <dt className="shrink-0 text-slate-500">Email</dt>
            <dd className="min-w-0 text-slate-200 break-all">{email}</dd>
          </div>
        ) : null}
        {phoneRaw ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
            <dt className="shrink-0 text-slate-500">Phone</dt>
            <dd className="min-w-0 text-slate-200 break-words">{phoneRaw}</dd>
          </div>
        ) : null}
      </dl>
      {(telHref || mailHref) && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {telHref ? (
            <a
              href={telHref}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#75C043] px-4 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-95 transition sm:flex-none sm:min-w-[7rem]"
            >
              Call
            </a>
          ) : null}
          {mailHref ? (
            <a
              href={mailHref}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5 transition sm:flex-none sm:min-w-[7rem]"
            >
              Email
            </a>
          ) : null}
        </div>
      )}
    </>
  );

  if (variant === "embedded") {
    return inner;
  }

  return <div className={`${CARD_CLASS} p-4 sm:p-5`}>{inner}</div>;
}
