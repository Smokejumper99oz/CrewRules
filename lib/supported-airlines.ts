/**
 * Supported (live) airline config.
 * CrewRules™ is live for these airlines; users with these domains + supported roles can create accounts.
 * Add entries here as new airlines launch.
 * role: "pilot" | "fa" — only listed roles are live for that domain.
 */
const LIVE_AIRLINES: {
  domain: string;
  signupRoute: string;
  liveRoles: readonly string[];
  displayName: string;
}[] = [
  {
    domain: "flyfrontier.com",
    signupRoute: "/frontier/pilots/sign-up",
    liveRoles: ["pilot"],
    displayName: "Frontier Airlines",
  },
];

/** Display names of airlines currently live for signup (for login page copy). */
export function getLiveAirlineDisplayNames(): string[] {
  return LIVE_AIRLINES.map((a) => a.displayName);
}

/** Domain -> config lookup */
const DOMAIN_TO_CONFIG = new Map(
  LIVE_AIRLINES.map((a) => [a.domain.toLowerCase(), a])
);

/**
 * Returns true if the email domain belongs to a live airline (any role may be live).
 */
export function isLiveAirlineEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return DOMAIN_TO_CONFIG.has(domain);
}

/**
 * Returns true if the email domain + role combination is live (user can create account).
 * e.g. flyfrontier.com + pilot = live; flyfrontier.com + fa = waitlist
 */
export function isLiveForEmailAndRole(email: string, role: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  const config = DOMAIN_TO_CONFIG.get(domain);
  if (!config) return false;
  const normalizedRole = role.trim().toLowerCase();
  return config.liveRoles.includes(normalizedRole);
}

/**
 * Returns the signup route for a live airline email, or null if not live.
 */
export function getSignupRouteForEmail(email: string): string | null {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return DOMAIN_TO_CONFIG.get(domain)?.signupRoute ?? null;
}

/** Domain -> airline name for inferring airline from email (used by waitlist). */
const DOMAIN_TO_AIRLINE: Record<string, string> = {
  "flyfrontier.com": "frontier",
  "delta.com": "delta",
  "united.com": "united",
  "southwest.com": "southwest",
  "spirit.com": "spirit",
  "americanairlines.com": "american",
  "jetblue.com": "jetblue",
  "b6.com": "jetblue",
  "alaskaair.com": "alaska",
  "allegiantair.com": "allegiant",
  "aa.com": "american",
};

/**
 * Infers airline name from email domain. Returns "unknown" if not recognized.
 */
export function inferAirlineFromEmail(email: string): string {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return DOMAIN_TO_AIRLINE[domain] ?? "unknown";
}
