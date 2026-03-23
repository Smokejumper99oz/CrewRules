/**
 * Focused tests for deriveOperationalStatus.
 * Run: npx tsx lib/commute/derive-operational-status.test.ts
 */

import { strict as assert } from "assert";
import { deriveOperationalStatus, parseTimestampProviderAware } from "./derive-operational-status";
import { operationalStatusToDisplayLabel } from "./operational-status-types";

const TZ = "America/New_York";
const DEP_UTC = "2026-03-18T11:59:00.000Z";
const ARR_UTC = "2026-03-18T13:08:00.000Z";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("derive-operational-status tests\n");

test("cancelled: provider status cancelled -> label cancelled", () => {
  const r = deriveOperationalStatus(
    { depUtc: DEP_UTC, arrUtc: ARR_UTC, status: "cancelled" },
    TZ,
    TZ
  );
  assert.equal(r.label, "cancelled");
  assert.equal(r.source_of_truth, "provider_status");
  assert.equal(operationalStatusToDisplayLabel(r.label), "Cancelled");
});

test("cancelled: provider status canceled (US spelling) -> label cancelled", () => {
  const r = deriveOperationalStatus(
    { depUtc: DEP_UTC, arrUtc: ARR_UTC, status: "canceled" },
    TZ,
    TZ
  );
  assert.equal(r.label, "cancelled");
});

test("numeric delay: dep_delay_min >= 1 -> delayed", () => {
  const r = deriveOperationalStatus(
    {
      depUtc: DEP_UTC,
      arrUtc: ARR_UTC,
      dep_delay_min: 66,
      arr_delay_min: 0,
    },
    TZ,
    TZ
  );
  assert.equal(r.label, "delayed");
  assert.equal(r.delay_minutes, 66);
  assert.equal(r.source_of_truth, "dep_delay_min");
  assert.equal(operationalStatusToDisplayLabel(r.label), "Delayed");
});

test("numeric delay: arr_delay_min >= 1 -> delayed", () => {
  const r = deriveOperationalStatus(
    {
      depUtc: DEP_UTC,
      arrUtc: ARR_UTC,
      dep_delay_min: 0,
      arr_delay_min: 30,
    },
    TZ,
    TZ
  );
  assert.equal(r.label, "delayed");
  assert.equal(r.delay_minutes, 30);
  assert.equal(r.source_of_truth, "arr_delay_min");
});

test("timestamp delay: sched vs estimated >= 60s -> delayed", () => {
  const r = deriveOperationalStatus(
    {
      depUtc: DEP_UTC,
      arrUtc: ARR_UTC,
      dep_scheduled_raw: "2026-03-18T06:59",
      dep_estimated_raw: "2026-03-18T08:05",
      arr_scheduled_raw: "2026-03-18T08:08",
      arr_estimated_raw: "2026-03-18T09:14",
    },
    TZ,
    TZ
  );
  assert.equal(r.label, "delayed");
  assert.ok((r.delay_minutes ?? 0) >= 1);
  assert.ok(r.source_of_truth === "timestamp_dep" || r.source_of_truth === "timestamp_arr");
});

test("valid on_time: live evidence with no delay", () => {
  const r = deriveOperationalStatus(
    {
      depUtc: DEP_UTC,
      arrUtc: ARR_UTC,
      dep_scheduled_raw: "2026-03-18T06:59",
      dep_estimated_raw: "2026-03-18T06:59",
      arr_scheduled_raw: "2026-03-18T08:08",
      arr_estimated_raw: "2026-03-18T08:08",
    },
    TZ,
    TZ
  );
  assert.equal(r.label, "on_time");
  assert.equal(r.source_of_truth, "proven_on_time");
  assert.equal(operationalStatusToDisplayLabel(r.label), "On time");
});

test("unknown fallback: no evidence -> unknown", () => {
  const r = deriveOperationalStatus(
    { depUtc: DEP_UTC, arrUtc: ARR_UTC },
    TZ,
    TZ
  );
  assert.equal(r.label, "unknown");
  assert.equal(r.source_of_truth, "unknown_fallback");
  assert.equal(operationalStatusToDisplayLabel(r.label), "Scheduled");
});

test("unknown: never maps to On time", () => {
  assert.equal(operationalStatusToDisplayLabel("unknown"), "Scheduled");
  assert.notEqual(operationalStatusToDisplayLabel("unknown"), "On time");
});

test("offset-aware timestamp: Z parses as UTC", () => {
  const d = parseTimestampProviderAware("2026-03-18T11:59:00.000Z", TZ);
  assert.ok(d !== null);
  assert.equal(d!.toISOString(), "2026-03-18T11:59:00.000Z");
});

test("offset-aware timestamp: +00:00 parses as UTC", () => {
  const d = parseTimestampProviderAware("2026-03-18T11:59:00+00:00", TZ);
  assert.ok(d !== null);
  assert.equal(d!.toISOString(), "2026-03-18T11:59:00.000Z");
});

test("airport-local naive: offsetless parses in timezone", () => {
  const d = parseTimestampProviderAware("2026-03-18T06:59", TZ);
  assert.ok(d !== null);
  assert.ok(d!.toISOString().startsWith("2026-03-18T1")); // 06:59 EDT = 10:59 UTC
});

test("provider status text indicating delay -> delayed (no timing evidence)", () => {
  const r = deriveOperationalStatus(
    { depUtc: DEP_UTC, arrUtc: ARR_UTC, status: "delayed" },
    TZ,
    TZ
  );
  assert.equal(r.label, "delayed");
  assert.equal(r.source_of_truth, "provider_status");
});

test("proven on_time overrides provider status delayed (timing evidence wins)", () => {
  const r = deriveOperationalStatus(
    {
      depUtc: DEP_UTC,
      arrUtc: ARR_UTC,
      status: "delayed",
      dep_scheduled_raw: "2026-03-18T06:59",
      dep_estimated_raw: "2026-03-18T06:59",
      arr_scheduled_raw: "2026-03-18T08:08",
      arr_estimated_raw: "2026-03-18T08:08",
    },
    TZ,
    TZ
  );
  assert.equal(r.label, "on_time");
  assert.equal(r.source_of_truth, "proven_on_time");
});

test("provider status diverted -> delayed", () => {
  const r = deriveOperationalStatus(
    { depUtc: DEP_UTC, arrUtc: ARR_UTC, status: "diverted" },
    TZ,
    TZ
  );
  assert.equal(r.label, "delayed");
});

console.log("\nAll tests passed.");
