import { getProfile } from "@/lib/profile";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { getTenantSourceTimezone } from "@/lib/tenant-config";
import { getNextFlight } from "@/lib/weather-brief/get-next-flight";
import { getAirportWeather } from "@/lib/weather-brief/get-airport-weather";
import { getEnrouteAdvisories } from "@/lib/weather-brief/get-enroute-advisories";
import { getFiledRoute } from "@/lib/weather-brief/get-filed-route";
import { cacheFiledRoute } from "@/lib/weather-brief/cache-filed-route";
import { computeDelayRisk, computeOperationalWatch, computeRiskSummary } from "@/lib/weather-brief/compute-risks";
import FiledRouteCard from "@/components/weather/filed-route-card";
import { FlightHeader } from "@/components/weather-brief/FlightHeader";
import { RiskSummary } from "@/components/weather-brief/RiskSummary";
import { AirportWeatherCard } from "@/components/weather-brief/AirportWeatherCard";
import { DelayRiskCard } from "@/components/weather-brief/DelayRiskCard";
import { EnrouteWeatherCard } from "@/components/weather-brief/EnrouteWeatherCard";
import { OperationalWatchItems } from "@/components/weather-brief/OperationalWatchItems";
import { SourcesSection } from "@/components/weather-brief/SourcesSection";
import { WeatherRefreshTrigger } from "@/components/weather-brief/WeatherRefreshTrigger";
import { WeatherBriefNotice } from "@/components/weather-brief/WeatherBriefNotice";

export default async function WeatherBriefPage() {
  const profile = await getProfile();
  const timezone =
    profile?.base_timezone?.trim() ??
    (profile?.base_airport ? getTimezoneFromAirport(profile.base_airport) : getTenantSourceTimezone(profile?.tenant ?? "frontier"));

  const nextFlight = await getNextFlight();

  if (nextFlight.status === "reserve") {
    return (
      <div className="space-y-6 md:space-y-8">
        <WeatherBriefNotice departureIso={null} />
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6 lg:p-8">
          <h2 className="text-lg font-semibold text-white">No Flight Assigned</h2>
          <p className="mt-3 text-slate-300">
            No current flights are scheduled.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Your Weather Brief will populate automatically once a trip is assigned.
          </p>
        </div>
        <SourcesSection />
      </div>
    );
  }

  const { departureAirport, arrivalAirport, departureIso, arrivalIso } = nextFlight;

  const routeLookup =
    nextFlight.status === "flight"
      ? {
          flightNumber: nextFlight.flightNumber,
          origin: nextFlight.departureAirport,
          destination: nextFlight.arrivalAirport,
          departureIso: nextFlight.departureIso,
          tenant: profile?.tenant ?? "frontier",
        }
      : null;

  // 1. Prefer schedule_events.filed_route; 2. getFiledRoute checks flight_route_cache then API (time-window gated)
  const filedRoute =
    nextFlight.status === "flight"
      ? nextFlight.filedRoute ?? (routeLookup ? await getFiledRoute(routeLookup) : null)
      : null;

  if (
    nextFlight.status === "flight" &&
    !nextFlight.filedRoute &&
    filedRoute &&
    nextFlight.eventId
  ) {
    await cacheFiledRoute(nextFlight.eventId, filedRoute);
  }

  const depTz = getTimezoneFromAirport(departureAirport);
  const arrTz = getTimezoneFromAirport(arrivalAirport);
  const [depWeather, arrWeather, advisories] = await Promise.all([
    getAirportWeather(departureAirport, depTz, {
      departureIso: departureIso ?? undefined,
      label: "departure",
    }),
    getAirportWeather(arrivalAirport, arrTz, {
      arrivalIso: arrivalIso ?? undefined,
      label: "arrival",
    }),
    getEnrouteAdvisories(departureAirport, arrivalAirport),
  ]);

  const delayRisks = computeDelayRisk(depWeather, arrWeather);
  const watchItems = computeOperationalWatch(depWeather, arrWeather, advisories);
  const riskSummary = computeRiskSummary(
    delayRisks.departure.level,
    delayRisks.arrival.level,
    advisories,
    watchItems
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <WeatherBriefNotice departureIso={departureIso ?? null} />
      <WeatherRefreshTrigger departureIso={departureIso ?? null} />
      <FlightHeader flight={nextFlight} />
      {nextFlight.status === "flight" && (
        <FiledRouteCard flight={nextFlight} routeText={filedRoute} />
      )}
      <RiskSummary
        level={riskSummary.level}
        reason={riskSummary.reason}
        departureTriggers={delayRisks.departure.triggers ?? []}
        arrivalTriggers={delayRisks.arrival.triggers ?? []}
        departureReason={delayRisks.departure.reason}
        arrivalReason={delayRisks.arrival.reason}
        hasAdvisories={advisories.length > 0}
      />

      <section>
        <AirportWeatherCard
          context="departure"
          airport={departureAirport}
          airportName={depWeather.airportName}
          localTimeLabel={depWeather.localTimeLabel}
          zuluTimeLabel={depWeather.zuluTimeLabel}
          updatedAt={depWeather.updatedAt}
          metarRaw={depWeather.metarRaw}
          tafRaw={depWeather.tafRaw}
          sourceUrl={depWeather.sourceLinks.metarTaf}
          decodedCurrent={depWeather.decodedCurrent}
          operationalNoteCurrent={depWeather.decodedCurrent?.operationalNote}
          decodedForecast={depWeather.decodedForecast}
          forecastWindowLabel={depWeather.forecastWindowLabel ?? "Expected near departure"}
          operationalNoteForecast={depWeather.decodedForecast?.operationalNote}
        />
      </section>

      <section className="border-t border-white/5 pt-6">
        <AirportWeatherCard
          context="arrival"
          airport={arrivalAirport}
          airportName={arrWeather.airportName}
          localTimeLabel={arrWeather.localTimeLabel}
          zuluTimeLabel={arrWeather.zuluTimeLabel}
          updatedAt={arrWeather.updatedAt}
          metarRaw={arrWeather.metarRaw}
          tafRaw={arrWeather.tafRaw}
          sourceUrl={arrWeather.sourceLinks.metarTaf}
          decodedCurrent={arrWeather.decodedCurrent}
          operationalNoteCurrent={arrWeather.decodedCurrent?.operationalNote}
          decodedForecast={arrWeather.decodedForecast}
          forecastWindowLabel={arrWeather.forecastWindowLabel ?? "Expected near arrival"}
          operationalNoteForecast={arrWeather.decodedForecast?.operationalNote}
        />
      </section>

      <DelayRiskCard
        departureAirport={departureAirport}
        arrivalAirport={arrivalAirport}
        departureRisk={delayRisks.departure.level}
        departureReason={delayRisks.departure.reason}
        arrivalRisk={delayRisks.arrival.level}
        arrivalReason={delayRisks.arrival.reason}
      />

      <EnrouteWeatherCard advisories={advisories} />
      <OperationalWatchItems items={watchItems} />
      <SourcesSection />
    </div>
  );
}
