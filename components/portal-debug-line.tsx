const SHOW_DEBUG =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEBUG_PORTAL_GATE === "1";

export function PortalDebugLine({
  email,
  role,
  tenant,
  portal,
}: {
  email?: string;
  role: string;
  tenant: string;
  portal: string;
}) {
  if (!SHOW_DEBUG) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-950/20 px-4 py-1.5 text-xs text-amber-200/90">
      <span className="font-mono">
        {email ?? "(no email)"} | role: {role} | tenant: {tenant} / portal: {portal}
      </span>
    </div>
  );
}
