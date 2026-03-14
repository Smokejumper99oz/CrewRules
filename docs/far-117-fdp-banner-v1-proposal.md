# FAR 117 FDP Warning Banner — v1 Proposal (Bella Rules)

## 1. Current Trip Data Flow

| Data | Source | Notes |
|------|--------|-------|
| **Report time** | `event.report_time` (text HH:MM) from `schedule_events` | Override when out-of-base: `reportTimeOverride = subtractMinutesFromTime(legsToShow[0].depTime, 45)`. Effective report = `reportTimeOverride ?? event.report_time`. |
| **Projected duty end** | `event.end_time` (ISO UTC) from `schedule_events` | Same as OnDutyTimer `endTime`. |
| **Segment count** | `event.legs` from `schedule_events` | Full duty legs. Exclude deadheads for FAR 117: `legs.filter(l => !l.deadhead && (l.blockMinutes ?? 0) > 0)` or `!l.deadhead`. |
| **Acclimated/base timezone** | `displaySettings.baseTimezone` | From `getScheduleDisplaySettings()` → `profile.base_timezone ?? (base_airport ? getTimezoneFromAirport(base_airport) : getTenantSourceTimezone(tenant))`. |

**FDP start**: FAR 117 FDP begins at report time. Build report datetime from `report_time` + first duty date (from `event.start_time` in acclimated TZ). If `report_time` is null, fall back to `event.start_time`.

---

## 2. Banner Insertion Point

**File**: `components/portal-next-duty.tsx`

**Location**: Inside `{hasSchedule && event && (` block, **immediately before** the `OnDutyTimer` (around line 369).

```
{hasSchedule && event && (
  ...
  {!activeTrip && <ScheduleEventCard ... />}
  {isOnDuty && <Far117FdpBanner ... />}   // NEW — insert here
  {isOnDuty && <OnDutyTimer ... />}
  <PortalNextDutyCommuteSection ... />
  ...
)}
```

**Condition**: Show banner only when `isOnDuty` (same as OnDutyTimer). Banner appears above the progress bar.

---

## 3. FDP Max Lookup Helper

**Name**: `getFar117MaxFdpMinutes`

**Signature**:
```ts
function getFar117MaxFdpMinutes(
  reportTimeLocal: { hour: number; minute: number },  // 0–23, 0–59 in acclimated TZ
  segmentCount: number,
  options?: { augmented?: boolean }  // v1: always false (unaugmented)
): number
```

**Logic**: Deterministic lookup per FAR 117 Table B (unaugmented). Map report hour to row, segment count to column, return max FDP in minutes.

**Table B (unaugmented) reference** — report time in acclimated local, segments = flight legs (excl. deadheads):

| Report (acclimated) | 1–2 seg | 3 seg | 4 seg | 5 seg | 6 seg | 7+ seg |
|--------------------|---------|-------|-------|-------|-------|--------|
| 0000–0359          | 9:00    | 9:00  | 9:00  | 9:00  | 9:00  | 9:00   |
| 0400–0459          | 10:00   | 10:00 | 10:00 | 9:30  | 9:00  | 9:00   |
| 0500–0559          | 12:00   | 12:00 | 12:00 | 11:30 | 11:00 | 10:30  |
| 0600–0659          | 13:00   | 13:00 | 12:30 | 12:00 | 11:30 | 11:00  |
| 0700–1159          | 14:00   | 13:30 | 13:00 | 12:30 | 12:00 | 11:30  |
| 1200–1659          | 13:00   | 13:00 | 12:30 | 12:00 | 11:30 | 11:00  |
| 1700–2159          | 12:00   | 12:00 | 11:30 | 11:00 | 10:30 | 9:00   |
| 2200–2359          | 9:00    | 9:00  | 9:00  | 9:00  | 9:00  | 9:00   |

*(Verify against current 14 CFR Part 117 Appendix B before implementation.)*

---

## 4. Elapsed / Remaining Helpers

**Name (elapsed)**: `computeProjectedFdpElapsedMinutes`

```ts
function computeProjectedFdpElapsedMinutes(
  reportTimeIso: string,   // FDP start (report time as UTC ISO)
  nowOrProjectedEndIso: string  // "now" for elapsed, or event.end_time for projected
): number
```

Returns `(end - start) / 60000` (minutes). Use `event.end_time` for "projected" remaining.

**Name (remaining)**: `computeFdpRemainingMinutes`

```ts
function computeFdpRemainingMinutes(
  maxFdpMinutes: number,
  elapsedMinutes: number
): number
```

Returns `maxFdpMinutes - elapsedMinutes`. Can be negative (exceeded).

---

## 5. Banner Thresholds

| State | Condition | Style |
|-------|-----------|-------|
| Exceeded | `remaining < 0` | Red, "FDP limit exceeded" |
| Critical | `remaining < 10` | Red |
| Warning | `remaining < 30` | Yellow |
| OK | `remaining >= 30` | No banner (or subtle info) |

---

## 6. Files to Touch

| File | Change |
|------|--------|
| `lib/far-117/fdp-max.ts` (new) | `getFar117MaxFdpMinutes` + Table B data |
| `lib/far-117/fdp-remaining.ts` (new) | `computeProjectedFdpElapsedMinutes`, `computeFdpRemainingMinutes` |
| `components/far-117-fdp-banner.tsx` (new) | Banner component |
| `components/portal-next-duty.tsx` | Import banner, insert before OnDutyTimer, pass props |

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| **Report time vs start_time** | `schedule_events.start_time` may not equal report. Prefer `report_time` + duty date for FDP start. If `report_time` null, use `start_time`. |
| **Acclimated vs duty-origin TZ** | v1 uses base (acclimated) TZ only. Red-eye from PHL→SJU: report may be in base TZ. If crew reports in PHL, true acclimated could differ. Document as v1 limitation. |
| **Segment count** | Use full-duty `event.legs`; exclude deadheads. Multi-day duty: use all legs in the FDP (event spans one duty). |
| **Out-of-base report override** | `reportTimeOverride` (dep - 45 min) is display-only. For FDP max, use same logic so report time is consistent. |
| **Table B accuracy** | Implement table from current 14 CFR; add unit tests; note "verify against official source" in code. |

---

## 8. Recommended Helper Names (Summary)

- `getFar117MaxFdpMinutes(reportTimeLocal, segmentCount, options?)`
- `computeProjectedFdpElapsedMinutes(reportTimeIso, endIso)`
- `computeFdpRemainingMinutes(maxFdpMinutes, elapsedMinutes)`
- Component: `Far117FdpBanner`
