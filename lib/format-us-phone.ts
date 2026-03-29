/**
 * US phone display: strip non-digits, cap at 10, format as (XXX) XXX-XXXX.
 * Used by mentor settings and super-admin user editor.
 *
 * As-you-type: 1–2 digits stay inside an open area code `(9…`; at 3 digits the
 * area code closes; then exchange and line with space and hyphen.
 */
export function formatUsPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 3) return `(${digits}`;
  if (digits.length === 3) return `(${digits})`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Format a stored phone for read-only display: (XXX) XXX-XXXX when 10 US digits
 * (optional single leading 1 / country code stripped). Otherwise returns trimmed original, or null if empty.
 */
export function formatUsPhoneStored(value: string | null | undefined): string | null {
  if (value == null || !String(value).trim()) return null;
  let digits = String(value).replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return formatUsPhoneDisplay(digits);
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}
