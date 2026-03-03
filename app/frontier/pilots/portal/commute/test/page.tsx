import { fetchFlightsFromAviationStack } from "@/lib/aviationstack";

export default async function CommuteTestPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string; destination?: string }>;
}) {
  const params = await searchParams;
  const origin = (params.origin ?? "TPA").toUpperCase();
  const destination = (params.destination ?? "SJU").toUpperCase();

  const flights = await fetchFlightsFromAviationStack(origin, destination, "2026-03-03", { noCache: true });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-xl font-semibold">Commute Test</h1>
      <p className="mt-1 text-sm text-slate-500">
        {origin} → {destination} • Found {flights.length} flights
      </p>

      <div className="mt-6 space-y-3">
        {flights.map((f) => (
          <div key={`${f.flightNumber}-${f.departureTime}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{f.flightNumber || "(unknown flight #)"}</div>
              <div className="text-sm text-slate-400">{f.durationMinutes} min</div>
            </div>
            <div className="mt-2 text-sm text-slate-300">
              {f.origin} {new Date(f.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} →{" "}
              {f.destination} {new Date(f.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
