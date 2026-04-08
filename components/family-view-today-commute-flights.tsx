import Image from "next/image";
import { formatInTimeZone } from "date-fns-tz";
import type { CommuteFlight } from "@/lib/aviationstack";
import { AIRLINE_NAMES, flightAwareUrl } from "@/lib/airlines";
import type { FamilyViewStrings } from "@/lib/family-view/family-view-i18n";

/** IATA → "City, State" for Family View. Fall back to code if unknown. */
const IATA_TO_CITY_STATE: Record<string, string> = {
  ATL: "Atlanta, GA",
  BOS: "Boston, MA",
  CLE: "Cleveland, OH",
  CLT: "Charlotte, NC",
  CVG: "Cincinnati, OH",
  DEN: "Denver, CO",
  DFW: "Dallas/Fort Worth, TX",
  FLL: "Fort Lauderdale, FL",
  IAH: "Houston, TX",
  JFK: "New York, NY",
  LAS: "Las Vegas, NV",
  LAX: "Los Angeles, CA",
  MDW: "Chicago, IL",
  MIA: "Miami, FL",
  MCO: "Orlando, FL",
  ORD: "Chicago, IL",
  PHL: "Philadelphia, PA",
  PHX: "Phoenix, AZ",
  SJU: "San Juan, PR",
  SFO: "San Francisco, CA",
  TPA: "Tampa, FL",
};

function formatAirportDisplay(iata: string): string {
  const code = (iata ?? "").trim().toUpperCase();
  return IATA_TO_CITY_STATE[code] ?? code;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract numeric flight number from carrier + flightNumber. */
function extractFlightNumber(carrier: string, flightNumber: string | undefined): string {
  const c = (carrier ?? "").trim().toUpperCase();
  const raw = (flightNumber ?? "").trim();
  if (!c && raw) {
    const m = raw.match(/^([A-Z0-9]{2})(\d+)$/i);
    return m?.[2] ?? raw;
  }
  const numPart = c
    ? raw.replace(new RegExp(`^${escapeRegExp(c)}`, "i"), "").trim().replace(/\D/g, "") || raw.replace(/\D/g, "")
    : raw.replace(/\D/g, "");
  return numPart || raw;
}

type Props = {
  flights: { flight: CommuteFlight; label: "Likely your flight" | "Backup option" }[];
  originTz: string;
  destTz: string;
  s: FamilyViewStrings;
  pilotFirstName: string;
  use24h?: boolean;
};

export function FamilyViewTodayCommuteFlights({ flights, originTz, destTz, s, pilotFirstName, use24h = false }: Props) {
  const timeFormat = use24h ? "HH:mm" : "h:mm a";
  return (
    <div className="space-y-1.5">
      {flights.map(({ flight, label }) => {
        const depTime = formatInTimeZone(new Date(flight.departureTime), originTz, timeFormat);
        const arrTime = formatInTimeZone(new Date(flight.arrivalTime), destTz, timeFormat);
        const isPrimary = label === "Likely your flight";

        const carrierCode = (flight.carrier ?? "").trim().toUpperCase();
        const flightNum = extractFlightNumber(flight.carrier, flight.flightNumber);
        const airlineName = carrierCode ? (AIRLINE_NAMES[carrierCode] ?? null) : null;

        const originCity = formatAirportDisplay(flight.origin);
        const destCity = formatAirportDisplay(flight.destination);
        const originIata = (flight.origin ?? "").trim().toUpperCase();
        const destIata = (flight.destination ?? "").trim().toUpperCase();

        return (
          <div
            key={`${flight.carrier}-${flight.flightNumber}-${flight.departureTime}`}
            className={`rounded-lg border bg-[#F9F8F5] px-3 py-2 space-y-1.5 ${isPrimary ? "border-[#7FB069]/50" : "border-[#E8E3DA]"}`}
          >
            {/* Row 1: Route + likely/backup label + times */}
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                <span className="font-medium text-[#2F2F2F]">{originCity}</span>
                <span className="rounded bg-[#EDE9E2] px-1.5 py-px text-[10px] font-medium text-[#7A7A7A] tracking-wide">{originIata}</span>
                <span className="mx-0.5 text-[#9AAE92]">→</span>
                <span className="font-medium text-[#2F2F2F]">{destCity}</span>
                <span className="rounded bg-[#EDE9E2] px-1.5 py-px text-[10px] font-medium text-[#7A7A7A] tracking-wide">{destIata}</span>
                {isPrimary ? (
                  <span className="rounded-full bg-[#E8F5E0] px-2 py-0.5 text-[10px] font-medium text-[#3A7A1A]">
                    {s.likelyYourFlight(pilotFirstName)}
                  </span>
                ) : (
                  <span className="rounded-full bg-[#EDE9E2] px-2 py-0.5 text-[10px] font-medium text-[#7A7A7A]">
                    {s.backupOption}
                  </span>
                )}
              </div>
              <div className="shrink-0 text-right text-xs tabular-nums text-[#6F6F6F]">
                {depTime} → {arrTime}
              </div>
            </div>

            {/* Row 2: Commute badge + airline logo + flight link */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                {s.commuteBadge}
              </span>
              {(carrierCode || flightNum) && (
                <div className="flex items-center gap-1.5">
                  {carrierCode && (
                    <Image
                      src={`https://www.gstatic.com/flights/airline_logos/70px/${carrierCode}.png`}
                      alt={airlineName ?? carrierCode}
                      width={20}
                      height={20}
                      className="rounded-sm"
                      unoptimized
                    />
                  )}
                  <span className="text-[11px] text-[#6F6F6F]">
                    {airlineName ?? carrierCode}
                    {flightNum && (
                      <a
                        href={flightAwareUrl(carrierCode, flightNum)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 font-medium text-[#3A7A1A] underline underline-offset-2 hover:text-[#2d6115]"
                      >
                        · Flight {flightNum} ↗
                      </a>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
