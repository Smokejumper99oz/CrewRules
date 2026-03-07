import crypto from "crypto";

export function generateInboundAlias(userId: string) {
  const short = crypto.createHash("sha256").update(userId).digest("hex").slice(0, 8);
  return `u_${short}`;
}
