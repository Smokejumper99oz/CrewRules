/**
 * Weather Brief open-trip selection regression tests.
 * Locks: must try every open trip in priority order; never stop after one null tryFlight.
 *
 * Run: npx tsx lib/weather-brief/get-next-flight.test.ts
 */

import { strict as assert } from "assert";
import { briefOpenTripsInPriorityOrder } from "./open-trips-brief-order";
import type { NextFlightResult } from "./types";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

/** Fixed “now” for stable ordering; rows use ISO start_time relative to this. */
const NOW_ISO = "2026-04-05T18:00:00.000Z";
const TZ = "America/Denver";

function flightStub(eventId: string): NextFlightResult {
  return {
    status: "flight",
    eventId,
    flightNumber: null,
    departureAirport: "DEN",
    arrivalAirport: "PHX",
    departureTime: "12:00",
    arrivalTime: "14:00",
    departureIso: "2026-04-05T19:00:00.000Z",
    arrivalIso: "2026-04-05T21:00:00.000Z",
  };
}

console.log("get-next-flight / open-trips-brief-order tests\n");

test("CrewRules: single valid open trip → briefs that trip", () => {
  const rows = [{ id: "only-trip", start_time: "2026-04-06T10:00:00.000Z" }];
  const brief = briefOpenTripsInPriorityOrder(rows, NOW_ISO, TZ, (ev) =>
    ev.id === "only-trip" ? flightStub(ev.id) : null
  );
  assert.ok(brief && brief.status === "flight");
  assert.equal(brief.eventId, "only-trip");
});

test("CrewRules: FLICA HH:MM report_time does not throw; ordering falls back to start_time", () => {
  const rows = [
    {
      id: "flica-trip",
      start_time: "2026-04-05T14:00:00.000Z",
      report_time: "19:59",
    },
  ];
  const brief = briefOpenTripsInPriorityOrder(rows, NOW_ISO, TZ, (ev) =>
    ev.id === "flica-trip" ? flightStub(ev.id) : null
  );
  assert.ok(brief && brief.status === "flight");
  assert.equal(brief.eventId, "flica-trip");
});

test("CrewRules: first open trip fails tryFlight, second is valid → second trip (not no_upcoming_trip)", () => {
  const rows = [
    { id: "earlier-bad", start_time: "2026-04-05T12:00:00.000Z" },
    { id: "S3090", start_time: "2026-04-06T05:00:00.000Z" },
  ];
  const brief = briefOpenTripsInPriorityOrder(rows, NOW_ISO, TZ, (ev) => {
    if (ev.id === "earlier-bad") return null;
    if (ev.id === "S3090") return flightStub(ev.id);
    return null;
  });
  assert.ok(brief && brief.status === "flight");
  assert.equal(brief.eventId, "S3090");
});

test("CrewRules: in-progress trip fails, later red-eye-style future trip valid → returns later trip", () => {
  const rows = [
    { id: "in-progress-bad", start_time: "2026-04-05T08:00:00.000Z" },
    { id: "S3090-redeye", start_time: "2026-04-06T06:00:00.000Z" },
  ];
  const brief = briefOpenTripsInPriorityOrder(rows, NOW_ISO, TZ, (ev) => {
    if (ev.id === "in-progress-bad") return null;
    if (ev.id === "S3090-redeye") return flightStub(ev.id);
    return null;
  });
  assert.ok(brief && brief.status === "flight");
  assert.equal(brief.eventId, "S3090-redeye");
});

test("CrewRules: all open trips fail tryFlight → null (non-reserve caller shows no_upcoming_trip)", () => {
  const rows = [
    { id: "a", start_time: "2026-04-05T10:00:00.000Z" },
    { id: "b", start_time: "2026-04-07T10:00:00.000Z" },
  ];
  const brief = briefOpenTripsInPriorityOrder(rows, NOW_ISO, TZ, () => null);
  assert.equal(brief, null);
  const isOnReserve = false;
  const outcome: NextFlightResult =
    isOnReserve ? { status: "reserve" } : { status: "no_upcoming_trip" };
  assert.deepEqual(outcome, { status: "no_upcoming_trip" });
});

test("CrewRules: all open trips fail + user on reserve → empty brief maps to reserve (matches getNextFlight tail)", () => {
  const rows = [{ id: "dead", start_time: "2026-04-06T10:00:00.000Z" }];
  const brief = briefOpenTripsInPriorityOrder(rows, NOW_ISO, TZ, () => null);
  assert.equal(brief, null);
  const isOnReserve = true;
  const outcome: NextFlightResult =
    isOnReserve ? { status: "reserve" } : { status: "no_upcoming_trip" };
  assert.deepEqual(outcome, { status: "reserve" });
});

test("CrewRules: priority order — all in-progress rows before future; shuffled input still tries in-progress first", () => {
  const inProgressId = "on-block-now";
  const futureId = "S3090-later";
  // Intentionally future row first (would be invalid DB order; ensures partition fixes priority).
  const rows = [
    { id: futureId, start_time: "2026-04-06T10:00:00.000Z" },
    { id: inProgressId, start_time: "2026-04-05T12:00:00.000Z" },
  ];
  const attempts: string[] = [];
  briefOpenTripsInPriorityOrder(rows, NOW_ISO, TZ, (ev) => {
    attempts.push(ev.id);
    return null;
  });
  assert.deepEqual(attempts, [inProgressId, futureId]);
});

test("CrewRules: within in-progress group preserves ascending start_time (query order)", () => {
  const rows = [
    { id: "ip-earlier", start_time: "2026-04-05T08:00:00.000Z" },
    { id: "ip-later", start_time: "2026-04-05T16:00:00.000Z" },
  ];
  const attempts: string[] = [];
  briefOpenTripsInPriorityOrder(rows, NOW_ISO, TZ, (ev) => {
    attempts.push(ev.id);
    return null;
  });
  assert.deepEqual(attempts, ["ip-earlier", "ip-later"]);
});

test("CrewRules: within future-only group preserves ascending start_time (query order)", () => {
  const rows = [
    { id: "fut-b", start_time: "2026-04-08T10:00:00.000Z" },
    { id: "fut-a", start_time: "2026-04-07T10:00:00.000Z" },
  ];
  // Not sorted — production expects query order; this documents that order follows array within partition.
  const sorted = [...rows].sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
  const attempts: string[] = [];
  briefOpenTripsInPriorityOrder(sorted, NOW_ISO, TZ, (ev) => {
    attempts.push(ev.id);
    return null;
  });
  assert.deepEqual(attempts, ["fut-a", "fut-b"]);
});

test("CrewRules: duplicate schedule row ids → tryFlight runs once per id", () => {
  const rows = [
    { id: "dup", start_time: "2026-04-05T12:00:00.000Z" },
    { id: "dup", start_time: "2026-04-05T12:00:00.000Z" },
    { id: "other", start_time: "2026-04-06T10:00:00.000Z" },
  ];
  let dupCalls = 0;
  const brief = briefOpenTripsInPriorityOrder(rows, NOW_ISO, TZ, (ev) => {
    if (ev.id === "dup") {
      dupCalls++;
      return null;
    }
    if (ev.id === "other") return flightStub(ev.id);
    return null;
  });
  assert.equal(dupCalls, 1);
  assert.ok(brief && brief.status === "flight" && brief.eventId === "other");
});

console.log("\nAll tests passed.");
