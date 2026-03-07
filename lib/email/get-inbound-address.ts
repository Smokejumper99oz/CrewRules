export function getInboundAddress(alias: string) {
  const domain = process.env.INBOUND_EMAIL_DOMAIN;
  if (!domain) throw new Error("Missing INBOUND_EMAIL_DOMAIN");
  return `${alias}@${domain}`;
}
