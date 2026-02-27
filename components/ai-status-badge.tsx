"use client";

export function AIStatusBadge({
  status,
  indexing,
}: {
  status: "active" | "not_enabled" | "processing";
  indexing?: boolean;
}) {
  const effective = indexing ? "processing" : status;
  const config = {
    active: { dot: "🟢", label: "AI Search: Active", className: "text-emerald-400" },
    processing: { dot: "🟡", label: "AI Search: Processing", className: "text-amber-400" },
    not_enabled: { dot: "🔴", label: "AI Search: Not Enabled", className: "text-red-400" },
  }[effective];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs ${config.className}`}>
      <span aria-hidden>{config.dot}</span>
      <span>{config.label}</span>
    </span>
  );
}
