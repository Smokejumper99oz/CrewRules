export function sanitizeDisplayNameForPath(name: string): string {
  return name.replace(/[^a-zA-Z0-9. \-]/g, "_").replace(/\s+/g, " ").trim().replace(/\s+/g, "_") || "document";
}
