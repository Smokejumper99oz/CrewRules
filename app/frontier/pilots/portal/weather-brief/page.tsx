import { getProfile, isProActive } from "@/lib/profile";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { getTenantSourceTimezone } from "@/lib/tenant-config";
import { getNextFlight } from "@/lib/weather-brief/get-next-flight";
import { getAirportWeather } from "@/lib/weather-brief/get-airport-weather";
import { getEnrouteAdvisories } from "@/lib/weather-brief/get-enroute-advisories";
import { getFiledRoute } from "@/lib/weather-brief/get-filed-route";
import { cacheFiledRoute } from "@/lib/weather-brief/cache-filed-route";
import { computeDelayRisk, computeOperationalWatch, computeRiskSummary } from "@/lib/weather-brief/compute-risks";
import { buildPilotSummary } from "@/lib/weather-brief/pilot-summary";
import FiledRouteCard from "@/components/weather/filed-route-card";
import { FlightHeader } from "@/components/weather-brief/FlightHeader";
import { RiskSummary } from "@/components/weather-brief/RiskSummary";
import { PilotSummary } from "@/components/weather-brief/PilotSummary";
import { AirportWeatherCard } from "@/components/weather-brief/AirportWeatherCard";
import { DelayRiskCard } from "@/components/weather-brief/DelayRiskCard";
import { EnrouteWeatherCard } from "@/components/weather-brief/EnrouteWeatherCard";
import { OperationalWatchItems } from "@/components/weather-brief/OperationalWatchItems";
import { SourcesSection } from "@/components/weather-brief/SourcesSection";
import { WeatherRefreshTrigger } from "@/components/weather-brief/WeatherRefreshTrigger";
import { WeatherBriefNotice } from "@/components/weather-brief/WeatherBriefNotice";
import { EnrouteIntelligenceCard } from "@/components/weather-brief/enroute-intelligence-card";
import { OperationalNotamsCard } from "@/components/weather-brief/OperationalNotamsCard";
import { getOperationalNotamsForBrief } from "@/lib/weather-brief/notams/get-operational-notams-for-brief";
import { buildNotamSummaryLine } from "@/lib/weather-brief/build-notam-summary-line";
import { buildEnrouteStationsForWeatherBrief } from "@/lib/weather-brief/enroute/build-enroute-stations-for-weather-brief";
import { computeWeatherBriefRouteMessagingState } from "@/lib/weather-brief/weather-brief-route-messaging";

export default async function WeatherBriefPage() {
  const profile = await getProfile();
  const proActive = isProActive(profile);
  const briefProductName = proActive ? "Advanced Weather Brief" : "Weather Brief";
  const timezone =
    profile?.base_timezone?.trim() ??
    (profile?.base_airport ? getTimezoneFromAirport(profile.base_airport) : getTenantSourceTimezone(profile?.tenant ?? "frontier"));

  const nextFlight = await getNextFlight();

  if (nextFlight.status === "reserve") {
    return (
      <div className="min-w-0 space-y-6 md:space-y-8">
        <WeatherBriefNotice departureIso={null} advancedWeatherBrief={proActive} />
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6 lg:p-8">
          <h2 className="text-lg font-semibold text-white">No Flight Assigned</h2>
          <p className="mt-3 text-slate-300">
            No current flights are scheduled.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Your {briefProductName} will populate automatically once a trip is assigned.
          </p>
        </div>
        <SourcesSection />
      </div>
    );
  }

  if (nextFlight.status === "no_upcoming_trip") {
    return (
      <div className="min-w-0 space-y-6 md:space-y-8">
        <WeatherBriefNotice departureIso={null} advancedWeatherBrief={proActive} />
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6 lg:p-8">
          <h2 className="text-lg font-semibold text-white">No upcoming trip</h2>
          <p className="mt-3 text-slate-300">
            There isn&apos;t a trip on your schedule we can brief yet.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            After your next pairing appears in CrewRules™, {briefProductName} will show weather for that flight automatically.
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
          user_id: profile?.id,
        }
      : null;

  // Always resolve Filed Route per leg using getFiledRoute(routeLookup). Trip-level schedule_events.filed_route can be wrong for multi-leg trips.
  const filedResult =
    nextFlight.status === "flight" && routeLookup
      ? await getFiledRoute(routeLookup)
      : null;
  const filedRoute = filedResult?.route ?? null;
  const liveStatus = filedResult?.status ?? null;
  const filedRouteState = filedResult?.filedRouteState ?? "unavailable";

  if (
    nextFlight.status === "flight" &&
    !nextFlight.filedRoute &&
    filedRoute &&
    nextFlight.eventId
  ) {
    await cacheFiledRoute(nextFlight.eventId, filedRoute);
  }

  const flightWithLiveStatus =
    nextFlight.status === "flight"
      ? { ...nextFlight, liveStatus }
      : nextFlight;

  const depTz = getTimezoneFromAirport(departureAirport);
  const arrTz = getTimezoneFromAirport(arrivalAirport);
  const [
    depWeather,
    arrWeather,
    {
      timeRelevantOperational: enrouteAdvisoriesTimeRelevant,
      display: enrouteAdvisoriesDisplay,
    },
    operationalNotams,
  ] = await Promise.all([
    getAirportWeather(departureAirport, depTz, {
      departureIso: departureIso ?? undefined,
      label: "departure",
    }),
    getAirportWeather(arrivalAirport, arrTz, {
      arrivalIso: arrivalIso ?? undefined,
      label: "arrival",
    }),
    getEnrouteAdvisories(departureAirport, arrivalAirport, {
      filedRouteAvailable: Boolean(filedRoute?.trim()),
      departureUtc: departureIso ? new Date(departureIso) : null,
    }),
    getOperationalNotamsForBrief(departureAirport, arrivalAirport),
  ]);

  const notamSummaryLine = buildNotamSummaryLine(operationalNotams);

  const enrouteStations =
    nextFlight.status === "flight" && departureIso && arrivalIso
      ? await buildEnrouteStationsForWeatherBrief({
          filedRouteText: filedRoute ?? "",
          originIcao: nextFlight.departureAirport,
          destinationIcao: nextFlight.arrivalAirport,
          departureIso,
          arrivalIso,
        })
      : [];

  const routeMessaging = computeWeatherBriefRouteMessagingState(
    filedRoute,
    enrouteStations.length
  );

  const delayRisks = computeDelayRisk(depWeather, arrWeather);
  const watchItems = computeOperationalWatch(
    depWeather,
    arrWeather,
    enrouteAdvisoriesTimeRelevant
  );
  const riskSummary = computeRiskSummary(
    delayRisks.departure.level,
    delayRisks.arrival.level,
    delayRisks.departure.reason,
    delayRisks.arrival.reason,
    enrouteAdvisoriesTimeRelevant,
    watchItems
  );
  const pilotSummary = buildPilotSummary({
    departureAirport,
    arrivalAirport,
    departureWeather: depWeather,
    arrivalWeather: arrWeather,
    departureRisk: delayRisks.departure.level,
    arrivalRisk: delayRisks.arrival.level,
    advisories: enrouteAdvisoriesTimeRelevant,
    watchItems,
    summaryLevel: riskSummary.level,
    routeMessaging,
  });

  return (
    <div className="min-w-0 space-y-6 md:space-y-8">
      <WeatherBriefNotice departureIso={departureIso ?? null} advancedWeatherBrief={proActive} />
      <WeatherRefreshTrigger departureIso={departureIso ?? null} />
      <FlightHeader flight={flightWithLiveStatus} proActive={proActive} />
      {nextFlight.status === "flight" && (
        <>
          <FiledRouteCard flight={nextFlight} routeText={filedRoute} filedRouteState={filedRouteState} hasFiledRoute={routeMessaging.hasFiledRoute} />
          <EnrouteIntelligenceCard
            departureAirport={nextFlight.departureAirport}
            arrivalAirport={nextFlight.arrivalAirport}
            departureIso={nextFlight.departureIso}
            blockMinutes={nextFlight.blockMinutes}
            enrouteStations={enrouteStations}
            routeMessaging={routeMessaging}
          />
        </>
      )}
      <PilotSummary
        lines={pilotSummary.lines}
        notamSummaryLine={notamSummaryLine}
      />
      <div id="weather-brief-operational-notams" className="scroll-mt-6">
        <OperationalNotamsCard result={operationalNotams} proActive={proActive} />
      </div>
      <RiskSummary
        level={riskSummary.level}
        reason={riskSummary.reason}
        departureTriggers={delayRisks.departure.triggers ?? []}
        arrivalTriggers={delayRisks.arrival.triggers ?? []}
        departureReason={delayRisks.departure.reason}
        arrivalReason={delayRisks.arrival.reason}
        hasAdvisories={enrouteAdvisoriesTimeRelevant.length > 0}
        categoryAlignmentNote={pilotSummary.categoryAlignmentNote}
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
          metarError={depWeather.metarError}
          tafError={depWeather.tafError}
          sourceUrl={depWeather.sourceLinks.metarTaf}
          decodedCurrent={depWeather.decodedCurrent}
          operationalNoteCurrent={depWeather.decodedCurrent?.operationalNote}
          decodedForecast={depWeather.decodedForecast}
          forecastWindowLabel={depWeather.forecastWindowLabel ?? "Expected near departure"}
          operationalNoteForecast={depWeather.decodedForecast?.operationalNote}
        />
      </section>

      <section className="border-t border-white/5 pt-6">
        <EnrouteWeatherCard
          advisories={enrouteAdvisoriesDisplay}
          enrouteStations={enrouteStations}
          departureAirport={nextFlight.departureAirport}
          arrivalAirport={nextFlight.arrivalAirport}
          routeMessaging={routeMessaging}
          proActive={proActive}
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
          metarError={arrWeather.metarError}
          tafError={arrWeather.tafError}
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

      <OperationalWatchItems items={watchItems} />
      <SourcesSection />
    </div>
  );
}
