import { getProfile, isProActive } from "@/lib/profile";

export default async function WeatherBriefLoading() {
  const profile = await getProfile();
  const title = isProActive(profile) ? "Loading Advanced Weather Brief..." : "Loading Weather Brief...";

  return (
    <div className="flex min-h-[min(60vh,32rem)] flex-col items-center justify-center gap-5 px-4 py-12 text-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-[#75C043]/40 border-t-[#75C043]"
        aria-hidden
      />
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        <p className="max-w-md text-sm text-slate-400">
          Analyzing your route, weather, and NOTAMs across multiple aviation data sources. This can take up to 30 seconds.
        </p>
      </div>
    </div>
  );
}
