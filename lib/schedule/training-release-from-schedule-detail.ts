/**
 * Infer SIM release UTC from per-day training labels when `training_release_time` is missing (older imports).
 */

import { fromZonedTime } from "date-fns-tz";
import { addDay } from "@/lib/schedule-time";

/**
 * Latest local SIM end instant in `trainingTz`, as ISO UTC.
 * Parses labels from `buildTrainingScheduleDetail` / My Schedule popover (e.g. "SIM · until 02:30", overnight (+1)).
 */
export function trainingReleaseIsoFromScheduleDetail(
  detail: Record<string, string> | null | undefined,
  trainingTz: string
): string | null {
  if (!detail || typeof detail !== "object") return null;
  let bestMs = -1;
  let bestIso: string | null = null;
  const pick = (iso: string) => {
    const ms = new Date(iso).getTime();
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      bestIso = iso;
    }
  };
  for (const [ymd, rawText] of Object.entries(detail)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || typeof rawText !== "string") continue;
    const chunks = rawText.split(";").map((s) => s.trim());
    for (const text of chunks) {
      const until = text.match(/^SIM · until (\d{2}):(\d{2})$/i);
      if (until) {
        try {
          pick(fromZonedTime(`${ymd}T${until[1]}:${until[2]}:00`, trainingTz).toISOString());
        } catch {
          /* skip */
        }
        continue;
      }
      const overnight = text.match(
        /^SIM · (\d{2}):(\d{2})\s*[–—\u2010\u2011-]\s*(\d{2}):(\d{2})\s*\(\+1\)$/i
      );
      if (overnight) {
        try {
          const endYmd = addDay(ymd);
          pick(
            fromZonedTime(`${endYmd}T${overnight[3]}:${overnight[4]}:00`, trainingTz).toISOString()
          );
        } catch {
          /* skip */
        }
      }
    }
  }
  return bestIso;
}
