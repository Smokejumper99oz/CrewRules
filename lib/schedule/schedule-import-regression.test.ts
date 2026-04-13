/**
 * Regression: FLICA training credit vs block, training/companion split, trip instance dedupe (pairing + date).
 * Run: npx tsx lib/schedule/schedule-import-regression.test.ts
 */

import { strict as assert } from "assert";
import {
  computeFlicaImportDeletionCandidateStartUpperBound,
  getTripInstanceDedupeKey,
  normalizeTrainingSplitRows,
  type TrainingSplitScheduleRow,
} from "./import-ics-from-text";
import { computeTrainingMonthCreditDeltas } from "./training-month-credit";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("schedule-import-regression tests\n");

const TZ = "America/Denver";

test("normalizeTrainingSplit: credit moves to training row; companion trip loses credit and block", () => {
  const rows: TrainingSplitScheduleRow[] = [
    {
      title: "S3A01A",
      event_type: "training",
      start_time: "2026-04-16T16:40:00.000Z",
      end_time: "2026-04-18T06:00:00.000Z",
      credit_minutes: null,
      credit_hours: null,
      baseline_credit_minutes: null,
      protected_credit_minutes: 0,
      protected_full_trip_paid_minutes: null,
      block_minutes: null,
      pairing_days: 2,
    },
    {
      title: "S3A01",
      event_type: "trip",
      start_time: "2026-04-16T16:40:00.000Z",
      end_time: "2026-04-21T06:16:00.000Z",
      credit_minutes: 1608,
      credit_hours: 1608 / 60,
      baseline_credit_minutes: 1608,
      protected_credit_minutes: 0,
      protected_full_trip_paid_minutes: null,
      block_minutes: 798,
      pairing_days: 4,
    },
  ];
  normalizeTrainingSplitRows(rows);
  const train = rows.find((r) => r.title === "S3A01A")!;
  const trip = rows.find((r) => r.title === "S3A01")!;
  assert.equal(train.credit_minutes, 1608);
  assert.equal(train.block_minutes, null);
  assert.equal(trip.credit_minutes, null);
  assert.equal(trip.block_minutes, null);
});

test("normalizeTrainingSplit: unrelated trip retains block (normal line flying)", () => {
  const rows: TrainingSplitScheduleRow[] = [
    {
      title: "SIM DAY",
      event_type: "training",
      start_time: "2026-04-10T12:00:00.000Z",
      end_time: "2026-04-10T20:00:00.000Z",
      credit_minutes: null,
      credit_hours: null,
      baseline_credit_minutes: null,
      protected_credit_minutes: 0,
      protected_full_trip_paid_minutes: null,
      block_minutes: null,
      pairing_days: null,
    },
    {
      title: "S3120 DEN-MCO",
      event_type: "trip",
      start_time: "2026-04-11T12:00:00.000Z",
      end_time: "2026-04-12T18:00:00.000Z",
      credit_minutes: 480,
      credit_hours: 8,
      baseline_credit_minutes: 480,
      protected_credit_minutes: 0,
      protected_full_trip_paid_minutes: null,
      block_minutes: 360,
      pairing_days: 2,
    },
  ];
  normalizeTrainingSplitRows(rows);
  const trip = rows.find((r) => r.title?.startsWith("S3120"))!;
  assert.equal(trip.block_minutes, 360);
  assert.equal(trip.credit_minutes, 480);
});

test("trip instance dedupe key: same pairing + same local start date → same key", () => {
  const k1 = getTripInstanceDedupeKey("S3120 DEN", "2026-04-02T15:00:00.000Z", TZ);
  const k2 = getTripInstanceDedupeKey("S3120 LAS", "2026-04-02T20:00:00.000Z", TZ);
  assert.equal(k1, k2);
  assert.equal(k1, "S3120_2026-04-02");
});

test("trip instance dedupe key: same pairing + different local start date → different keys (both valid trips)", () => {
  const k1 = getTripInstanceDedupeKey("S3120", "2026-04-02T12:00:00.000Z", TZ);
  const k2 = getTripInstanceDedupeKey("S3120", "2026-04-18T12:00:00.000Z", TZ);
  assert.notEqual(k1, k2);
});

test("trip instance dedupe key: no extractable pairing → null (guard skipped)", () => {
  assert.equal(getTripInstanceDedupeKey("OFF", "2026-04-02T12:00:00.000Z", TZ), null);
});

test("FLICA deletion window: last trip starts Apr 27, no Apr 30 row — upper bound still includes Apr 30 stale start", () => {
  const tz = "America/Puerto_Rico";
  const newImportRows = [
    {
      start_time: "2026-04-27T18:19:00.000Z",
      end_time: "2026-04-28T03:03:00.000Z",
    },
  ];
  const upper = computeFlicaImportDeletionCandidateStartUpperBound(newImportRows, tz);
  const staleApr30TripStart = "2026-04-30T12:00:00.000Z";
  assert.ok(
    new Date(upper).getTime() >= new Date(staleApr30TripStart).getTime(),
    `expected deletion upper bound to include Apr 30 stale trip start, got ${upper}`
  );
  const maxImportedStartOnly = newImportRows[0]!.start_time;
  assert.ok(
    new Date(upper).getTime() > new Date(maxImportedStartOnly).getTime(),
    "upper bound must exceed max imported start_time alone (previous bug cap)"
  );
});

test("simulate batch dedupe: second trip with same pairing+date key would be dropped", () => {
  const seen = new Set<string>();
  const titles = ["S3120 A", "S3120 B"] as const;
  const startIso = "2026-04-02T12:00:00.000Z";
  let kept = 0;
  for (const t of titles) {
    const key = getTripInstanceDedupeKey(t, startIso, TZ);
    assert.ok(key);
    if (seen.has(key)) continue;
    seen.add(key);
    kept++;
  }
  assert.equal(kept, 1);
});

test("computeTrainingMonthCreditDeltas: training credit counts toward month credit total", () => {
  const d = computeTrainingMonthCreditDeltas(
    {
      credit_minutes: 1608,
      credit_hours: null,
      protected_full_trip_paid_minutes: null,
      protected_credit_minutes: null,
      pairing_days: 5,
    },
    5
  );
  assert.equal(d.addTrainingCreditMinutes, 1608);
  assert.equal(d.addProtectedCreditMinutes, 0);
});

test("computeTrainingMonthCreditDeltas: does not use block — month block is trip-only path in getMonthStats", () => {
  const d = computeTrainingMonthCreditDeltas(
    {
      credit_minutes: 100,
      credit_hours: null,
      protected_full_trip_paid_minutes: null,
      protected_credit_minutes: null,
      pairing_days: 1,
    },
    1
  );
  assert.equal(d.addTrainingCreditMinutes, 100);
});

test("computeTrainingMonthCreditDeltas: protected full trip pay on training row", () => {
  const d = computeTrainingMonthCreditDeltas(
    {
      credit_minutes: 0,
      credit_hours: null,
      protected_full_trip_paid_minutes: 1000,
      protected_credit_minutes: 50,
      pairing_days: 2,
    },
    2
  );
  assert.equal(d.addTrainingCreditMinutes, 1000);
  assert.equal(d.addProtectedCreditMinutes, 0);
});

test("computeTrainingMonthCreditDeltas: incremental protected when no full-trip paid", () => {
  const d = computeTrainingMonthCreditDeltas(
    {
      credit_minutes: 200,
      credit_hours: null,
      protected_full_trip_paid_minutes: null,
      protected_credit_minutes: 40,
      pairing_days: 1,
    },
    1
  );
  assert.equal(d.addTrainingCreditMinutes, 200);
  assert.equal(d.addProtectedCreditMinutes, 40);
});

console.log("\nAll schedule-import-regression tests passed.\n");
