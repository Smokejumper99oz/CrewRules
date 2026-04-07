/**
 * Regression tests for parseElpPairingNotification.
 * Covers: LEG_ROW_RE trailing flags, time normalization, weekday, deadhead, report_time parse.
 *
 * Run: npx tsx lib/email/parse-elp-pairing-notification.test.ts
 */

import assert from "node:assert";
import { parseElpPairingNotification } from "./parse-elp-pairing-notification";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log("parse-elp-pairing-notification tests\n");

// ── LEG_ROW_RE ───────────────────────────────────────────────────────────────

test("LEG_ROW_RE: trailing D flag parses leg", () => {
  const body = `
  Pairing Number S3090A
  Added WN479 BDL MCO 04/07 16:55 (S) 04/07 19:55 (S) 00:00 D
  `;
  const parsed = parseElpPairingNotification(body);
  assert.strictEqual(parsed.legsAdded.length, 1);
});

test("LEG_ROW_RE: trailing N flag parses leg", () => {
  const body = `
  Pairing Number S3090A
  Added WN479 BDL MCO 04/07 16:55 (S) 04/07 19:55 (S) 00:00 N
  `;
  const parsed = parseElpPairingNotification(body);
  assert.strictEqual(parsed.legsAdded.length, 1);
});

test("LEG_ROW_RE: no trailing flag parses leg (baseline)", () => {
  const body = `
  Pairing Number S3090A
  Added WN479 BDL MCO 04/07 16:55 (S) 04/07 19:55 (S) 00:00
  `;
  const parsed = parseElpPairingNotification(body);
  assert.strictEqual(parsed.legsAdded.length, 1);
});

// ── TIME NORMALIZATION ────────────────────────────────────────────────────────

test("depTime and arrTime are HH:MM only — not date+time", () => {
  const body = `
  Pairing Number S3090A
  Added WN479 BDL MCO 04/07 16:55 (S) 04/07 19:55 (S) 00:00
  `;
  const parsed = parseElpPairingNotification(body);
  const leg = parsed.legsAdded[0]!;
  assert.strictEqual(leg.depTime, "16:55");
  assert.strictEqual(leg.arrTime, "19:55");
});

test("deleted leg depTime and arrTime are also HH:MM only", () => {
  const body = `
  Pairing Number S3090A
  Deleted 1683 BDL MCO 04/07 09:15 (E) 04/07 12:21 (E) 03:06
  `;
  const parsed = parseElpPairingNotification(body);
  const leg = parsed.legsDeleted[0]!;
  assert.strictEqual(leg.depTime, "09:15");
  assert.strictEqual(leg.arrTime, "12:21");
});

// ── WEEKDAY + DEADHEAD ────────────────────────────────────────────────────────

test("leg has valid two-char weekday abbreviation", () => {
  const body = `
  Pairing Number S3090A
  Added WN479 BDL MCO 04/07 16:55 (S) 04/07 19:55 (S) 00:00
  `;
  const parsed = parseElpPairingNotification(body);
  const leg = parsed.legsAdded[0]!;
  assert.ok(
    /^(Su|Mo|Tu|We|Th|Fr|Sa)$/.test(leg.day ?? ""),
    `expected valid weekday, got: ${leg.day}`,
  );
});

test("WN-prefixed flight is deadhead true", () => {
  const body = `
  Pairing Number S3090A
  Added WN479 BDL MCO 04/07 16:55 (S) 04/07 19:55 (S) 00:00
  `;
  const parsed = parseElpPairingNotification(body);
  assert.strictEqual(parsed.legsAdded[0]!.deadhead, true);
});

test("numeric flight is not deadhead", () => {
  const body = `
  Pairing Number S3090A
  Deleted 1683 BDL MCO 04/07 09:15 (E) 04/07 12:21 (E) 03:06
  `;
  const parsed = parseElpPairingNotification(body);
  assert.strictEqual(parsed.legsDeleted[0]!.deadhead, false);
});

// ── REPORT TIME PARSE ─────────────────────────────────────────────────────────

test("collapsed Modified Report line captures only date+time", () => {
  const body = `
  Pairing Number S3090A
  Modified Report DT : 04/06 21:08 Release DT : 04/06 21:09* Block : 00:00 Hotel : Doubletree
  `;
  const parsed = parseElpPairingNotification(body);
  assert.strictEqual(parsed.dutyModifications?.[0]?.reportText, "04/06 21:08");
});

test("asterisk-suffixed report time is captured cleanly", () => {
  const body = `
  Pairing Number S3090A
  Modified Report DT : 04/07 16:10*
  `;
  const parsed = parseElpPairingNotification(body);
  assert.strictEqual(parsed.dutyModifications?.[0]?.reportText, "04/07 16:10");
});

// ── GOLDEN TEST ───────────────────────────────────────────────────────────────

test("full parse produces normalized deadhead leg shape", () => {
  const body = `
  Pairing Number S3090A
  Added WN479 BDL MCO 04/07 16:55 (S) 04/07 19:55 (S) 00:00
  Deleted 1683 BDL MCO 04/07 09:15 (E) 04/07 12:21 (E) 03:06
  Modified Report DT : 04/07 16:10
  `;

  const parsed = parseElpPairingNotification(body);
  const leg = parsed.legsAdded[0]!;

  assert.strictEqual(parsed.pairingCode, "S3090A");
  assert.strictEqual(leg.flightNumber, "WN479");
  assert.strictEqual(leg.dep, "BDL");
  assert.strictEqual(leg.arr, "MCO");
  assert.strictEqual(leg.depTime, "16:55");
  assert.strictEqual(leg.arrTime, "19:55");
  assert.strictEqual(leg.deadhead, true);
  assert.ok(leg.day, "day must be set");
  assert.strictEqual(parsed.legsDeleted.length, 1);
  assert.strictEqual(parsed.dutyModifications?.[0]?.reportText, "04/07 16:10");
});

console.log("\nAll parse-elp-pairing-notification tests passed.\n");
