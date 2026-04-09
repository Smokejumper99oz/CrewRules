import { createHash, randomBytes } from "crypto";

const RAW_TOKEN_BYTE_LENGTH = 32;

/** Trim + lowercase for storage and lookups. */
export function normalizeFamilyViewInviteEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Strong random raw token (URL-safe) and SHA-256 hash for DB storage.
 * Raw token is never persisted; only tokenHash is stored.
 */
export function generateFamilyViewInviteTokenPair(): { rawToken: string; tokenHash: string } {
  const buf = randomBytes(RAW_TOKEN_BYTE_LENGTH);
  const rawToken = buf.toString("base64url");
  const tokenHash = createHash("sha256").update(buf).digest("hex");
  return { rawToken, tokenHash };
}

/**
 * Recompute the stored token_hash from the raw URL token (must match bytes used at creation).
 * Returns null if the string is not a valid base64url encoding of exactly 32 bytes.
 */
export function familyViewInviteTokenHashFromRaw(rawToken: string): string | null {
  const t = rawToken.trim();
  if (!t) return null;
  try {
    const buf = Buffer.from(t, "base64url");
    if (buf.length !== RAW_TOKEN_BYTE_LENGTH) return null;
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}
