import { formatInTimeZone } from "date-fns-tz";
import type { CommuteFlight } from "@/lib/aviationstack";
import { AIRLINE_NAMES } from "@/lib/airlines";

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
};

export function FamilyViewTodayCommuteFlights({ flights, originTz, destTz }: Props) {
  return (
    <div className="space-y-2">
      {flights.map(({ flight, label }) => {
        const depTime = formatInTimeZone(
          new Date(flight.departureTime),
          originTz,
          "h:mm a"
        );
        const arrTime = formatInTimeZone(
          new Date(flight.arrivalTime),
          destTz,
          "h:mm a"
        );
        const isPrimary = label === "Likely your flight";
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
                {label}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#6F6F6F]">
              {formatAirportDisplay(flight.origin)} to {formatAirportDisplay(flight.destination)}
            </p>
            <p className="mt-1 text-sm text-[#6F6F6F]">
              Departure: {depTime} · Arrival: {arrTime}
            </p>
          </div>
        );
      })}
    </div>
  );
}
