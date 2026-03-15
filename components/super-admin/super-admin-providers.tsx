import { Plane, Database, Brain, CreditCard } from "lucide-react";

const PROVIDERS = [
  { name: "FlightAware", icon: Plane },
  { name: "AeroDataBox", icon: Database },
  { name: "OpenAI / AI search", icon: Brain },
  { name: "Stripe / Square", icon: CreditCard },
] as const;

export function SuperAdminProviders() {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-200">Platform</h2>
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
        <div className="text-xs text-slate-500 mb-3">Provider status — not yet wired</div>
        <div className="flex flex-wrap gap-3">
          {PROVIDERS.map(({ name, icon: Icon }) => (
            <div
              key={name}
              className="flex items-center gap-2 rounded-lg border border-slate-600/40 bg-slate-800/30 px-3 py-2"
            >
              <Icon className="size-3.5 text-slate-500" />
              <span className="text-xs text-slate-400">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
