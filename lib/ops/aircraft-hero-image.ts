/**
 * Aircraft hero imagery for ops / pilot dashboards (Supabase Storage).
 *
 * **Future resolution priority** (not all wired yet):
 * 1. **Aircraft-specific** — object at `getAircraftHeroImagePath({ tenant, tailNumber })` in {@link AIRCRAFT_HERO_BUCKET}.
 * 2. **Operator default** — e.g. `tenants/{tenant}/aircraft/_default/hero.jpg` (path TBD when product defines it).
 * 3. **Static CrewRules demo fallback** — {@link getAircraftHeroImageFallback} for local/demo when no storage object exists.
 *
 * Storage URL resolution: `resolveAircraftHeroImageUrl` in `aircraft-hero-image.server.ts`.
 */

export const AIRCRAFT_HERO_BUCKET = "operator-assets";

/**
 * Guidance for uploads: landscape matches the hero crop (`object-cover` on a short, full-width band).
 * Height stays ~900px; width is moderate (about 2:1) so operators are not pushed toward ultra-wide panoramas.
 */
export const AIRCRAFT_HERO_IMAGE_SPECS = {
  /** ~2.1:1 — sharp on typical desktop without requiring a 21:9-style source file. */
  recommendedWidthPx: 1920,
  recommendedHeightPx: 900,
  /** Below this width, the image may look soft when the card is full width on desktop. */
  minWidthPx: 1280,
  /** JPEG, PNG, WebP — aligned with Storage `allowed_mime_types` where configured. */
  maxFileBytes: 8 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

export function isSafeAircraftHeroPathSegment(segment: string): boolean {
  return segment.length > 0 && !segment.includes("/") && !segment.includes("..");
}

// Hero images are intended to be uploaded during Super Admin/operator setup, not by tenant admins.

export type AircraftHeroImagePathParams = {
  tenant: string;
  tailNumber: string;
};

/**
 * Storage object path (no bucket prefix) for a tail-specific hero image.
 * Exact shape: `tenants/${tenant}/aircraft/${tailNumber}/hero.jpg`
 */
export function getAircraftHeroImagePath({ tenant, tailNumber }: AircraftHeroImagePathParams): string {
  return `tenants/${tenant}/aircraft/${tailNumber}/hero.jpg`;
}

/**
 * Public URL path served from `public/` (Next static asset).
 * Use until Storage + signed/public URLs are resolved per tenant/tail.
 */
export function getAircraftHeroImageFallback(): string {
  return "/demo135/pilot-hero-aircraft.png";
}
