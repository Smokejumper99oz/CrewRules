import { formatDisplayName } from "@/lib/format-display-name";
import { Mail } from "lucide-react";

type SuperAdminUserWithMailtoProps = {
  fullName?: string | null;
  email?: string | null;
  /** Precomputed label (e.g. import warnings); overrides name/email text resolution when set. */
  displayLabel?: string;
  nameClassName?: string;
  /** Extra classes on the outer wrapper (e.g. `w-full` in grid cells). */
  rootClassName?: string;
};

/**
 * Primary: formatted full name, or email if no name, or "—". Optional compact mailto affordance + email tooltip.
 */
export function SuperAdminUserWithMailto({
  fullName,
  email,
  displayLabel,
  nameClassName = "",
  rootClassName = "",
}: SuperAdminUserWithMailtoProps) {
  const emailTrim = email?.trim() || null;
  const na = formatDisplayName(fullName ?? null);
  const primaryText =
    displayLabel ?? (na || emailTrim || "—");
  const showMail = Boolean(emailTrim);
  const tooltip: string | undefined = emailTrim ? emailTrim : undefined;

  return (
    <span className={["flex min-w-0 items-center gap-1", rootClassName].filter(Boolean).join(" ")}>
      <span className={`min-w-0 flex-1 truncate ${nameClassName}`} title={tooltip}>
        {primaryText}
      </span>
      {showMail && (
        <a
          href={`mailto:${emailTrim}`}
          className="inline-flex shrink-0 rounded p-0.5 text-slate-500 transition-colors hover:text-[#75C043] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#75C043]/60"
          title={tooltip}
          aria-label={`Email ${primaryText}`}
        >
          <Mail className="size-3.5" aria-hidden />
        </a>
      )}
    </span>
  );
}
