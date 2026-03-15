import { format } from "date-fns";

type SuperAdminHeaderProps = {
  lastRefresh: string;
};

export function SuperAdminHeader({ lastRefresh }: SuperAdminHeaderProps) {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";

  return (
    <div className="pb-4 border-b border-slate-700/50">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Super Admin Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Platform Owner Console</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            {env === "production" ? "Production" : env}
          </span>
          <span>Refresh: {lastRefresh}</span>
        </div>
      </div>
    </div>
  );
}
