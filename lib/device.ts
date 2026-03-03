/**
 * Detects iPhone/iPad (including iPadOS 13+ which reports as Mac).
 * Client-safe: returns false when window is undefined (SSR).
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
