import { formatInTimeZone } from "date-fns-tz";
import type { CommuteFlight } from "@/lib/aviationstack";
import { AIRLINE_NAMES } from "@/lib/airlines";
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

/** Format as "AirlineName Flight 1234" for Family View (no carrier codes like F9/B6). */
function formatFlightLabel(carrier: string, flightNumber: string | undefined): string {
  const code = (carrier ?? "").trim().toUpperCase();
  const num = extractFlightNumber(carrier, flightNumber);
  const airlineName = code ? AIRLINE_NAMES[code] : null;
  if (airlineName && num) return `${airlineName} Flight ${num}`;
  if (num) return `Flight ${num}`;
  return airlineName ?? "Flight";
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
    <div className="space-y-2">
      {flights.map(({ flight, label }) => {
        const depTime = formatInTimeZone(
          new Date(flight.departureTime),
          originTz,
          timeFormat
        );
        const arrTime = formatInTimeZone(
          new Date(flight.arrivalTime),
          destTz,
          timeFormat
        );
        const isPrimary = label === "Likely your flight";
        const displayLabel = isPrimary ? s.likelyYourFlight(pilotFirstName) : s.backupOption;
        return (
          <div
            key={`${flight.carrier}-${flight.flightNumber}-${flight.departureTime}`}
            className={`rounded-xl border px-4 py-3 ${
              isPrimary
                ? "border-[#7FB069]/50 bg-[#E6F1EA]/60"
                : "border-[#E8E3DA] bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium text-[#2F2F2F]">
                {formatFlightLabel(flight.carrier, flight.flightNumber)}
              </span>
              <span
                className={`text-xs font-medium ${
                  isPrimary ? "text-[#7FB069]" : "text-[#6F6F6F]"
                }`}
              >
                {displayLabel}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-[#6F6F6F]">
              <span>{formatAirportDisplay(flight.origin)}</span>
              <span className="rounded bg-[#EDE9E2] px-1.5 py-px text-[10px] font-medium text-[#7A7A7A] tracking-wide">{(flight.origin ?? "").trim().toUpperCase()}</span>
              <span className="text-[#9AAE92]">→</span>
              <span>{formatAirportDisplay(flight.destination)}</span>
              <span className="rounded bg-[#EDE9E2] px-1.5 py-px text-[10px] font-medium text-[#7A7A7A] tracking-wide">{(flight.destination ?? "").trim().toUpperCase()}</span>
            </div>
            <p className="mt-1 text-sm text-[#6F6F6F]">
              {s.departureLabel} {depTime} · {s.arrivalLabel} {arrTime}
            </p>
          </div>
        );
      })}
    </div>
  );
}
