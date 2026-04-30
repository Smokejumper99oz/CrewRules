/**
 * Optional OpenAI summaries for Operational NOTAMs (Weather Brief server pipeline only).
 * Never exposes OPENAI_API_KEY; not for browser bundles.
 */

import OpenAI from "openai";

import type {
  OperationalNotamDecodedOverlay,
  OperationalNotamItem,
  OperationalNotamSeverity,
  OperationalNotamCategory,
} from "@/lib/weather-brief/notams/types";

const DEFAULT_MODEL = "gpt-4o-mini";
/** Cap per NOTAM in prompt chars to keep batch within context bounds. */
const RAW_TEXT_CAP = 6_000;
const BATCH_FETCH_MS = 45_000;

function isDecodeExplicitlyDisabled(): boolean {
  const v = (process.env.NOTAM_DECODE_ENABLED ?? "").trim().toLowerCase();
  return v === "0" || v === "false" || v === "off" || v === "disabled";
}

function resolveModel(): string {
  const m = (process.env.NOTAM_DECODE_MODEL ?? "").trim();
  return m || DEFAULT_MODEL;
}

function skippedMap(items: OperationalNotamItem[]): Map<string, OperationalNotamDecodedOverlay> {
  const m = new Map<string, OperationalNotamDecodedOverlay>();
  for (const it of items) {
    m.set(it.id, { decodeStatus: "skipped" });
  }
  return m;
}

function errorMap(items: OperationalNotamItem[], brief?: string): Map<string, OperationalNotamDecodedOverlay> {
  const m = new Map<string, OperationalNotamDecodedOverlay>();
  for (const it of items) {
    const overlay: OperationalNotamDecodedOverlay = brief
      ? { decodeStatus: "error", decodeErrorBrief: brief }
      : { decodeStatus: "error" };
    m.set(it.id, overlay);
  }
  return m;
}

type ParsedRow = {
  notamId?: unknown;
  id?: unknown;
  plainEnglish?: unknown;
  operationalImpact?: unknown;
  severity?: unknown;
  aiCategory?: unknown;
  category?: unknown;
  pilotAction?: unknown;
};

const SEVERITY_LIST: OperationalNotamSeverity[] = ["info", "caution", "warning", "critical"];

function isSeverity(s: unknown): s is OperationalNotamSeverity {
  return typeof s === "string" && (SEVERITY_LIST as readonly string[]).includes(s);
}

const CATEGORY_LIST: OperationalNotamCategory[] = [
  "runway",
  "ils",
  "navaid",
  "taxiway",
  "airport",
  "airspace",
  "other",
];

function normalizeCategory(s: unknown): OperationalNotamCategory {
  if (typeof s !== "string") return "other";
  const t = s.trim().toLowerCase();
  for (const c of CATEGORY_LIST) {
    if (t === c) return c;
  }
  return "other";
}

function coerceString(u: unknown, fallback = ""): string {
  if (typeof u === "string") return u.trim();
  return fallback;
}

function extractJsonArray(content: string): unknown[] | null {
  let t = content.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence?.[1]) t = fence[1].trim();
  try {
    const parsed = JSON.parse(t) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function withTimeoutMs<T>(promise: Promise<T>, ms: number, label = "timeout"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Produce decode overlays keyed by OperationalNotamItem.id.
 * Never throws; assigns error overlays only on total failure branches.
 */
export async function decodeOperationalNotamItems(
  items: OperationalNotamItem[]
): Promise<Map<string, OperationalNotamDecodedOverlay>> {
  if (items.length === 0) return new Map();

  if (isDecodeExplicitlyDisabled()) {
    return skippedMap(items);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return skippedMap(items);
  }

  const inputPayload = items.map((it) => ({
    id: it.id,
    stationIcao: it.stationIcao,
    heuristicCategory: it.category,
    rawText: it.rawText.length > RAW_TEXT_CAP ? `${it.rawText.slice(0, RAW_TEXT_CAP)}…` : it.rawText,
  }));

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await withTimeoutMs(
      openai.chat.completions.create({
        model: resolveModel(),
        max_tokens: 3_500,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You decode aviation NOTAM text for airline pilots. Output MUST be ONLY a valid JSON array. No markdown, no prose before or after.
Each element must be an object with keys exactly:
"notamId" (string, MUST match an input item id exactly),
"plainEnglish" (string, 1–4 sentences explaining the NOTAM in plain language),
"operationalImpact" (string, ONE sentence on runway/taxi/nav/airspace/closure impact relevant to PIC),
"severity" — one string: info | caution | warning | critical (be conservative),
"aiCategory" — one string: runway | ils | navaid | taxiway | airport | airspace | other,
"pilotAction" (string, concise practical takeaway).

Do not invent NOTAM-specific facts absent from rawText (no invented dates, closures, runway IDs). If ambiguous, reflect uncertainty in wording and lower severity appropriately.
Return one object per input NOTAM, matching every notamId to the inputs.`,
          },
          {
            role: "user",
            content: JSON.stringify({ notams: inputPayload }),
          },
        ],
      }),
      BATCH_FETCH_MS,
      "decode_timeout"
    );

    const raw = completion.choices[0]?.message?.content ?? "";
    const arr = extractJsonArray(raw);
    if (!arr?.length) {
      console.warn("[notam-decode] Empty or unparsable model JSON batch");
      return errorMap(items, "Could not parse AI summaries.");
    }

    const byId = new Map<string, ParsedRow>();
    for (const row of arr) {
      if (!row || typeof row !== "object") continue;
      const r = row as ParsedRow;
      const nid = coerceString(r.notamId ?? r.id);
      if (!nid) continue;
      byId.set(nid, r);
    }

    const result = new Map<string, OperationalNotamDecodedOverlay>();
    for (const it of items) {
      const row = byId.get(it.id);
      if (!row) {
        result.set(it.id, {
          decodeStatus: "error",
          decodeErrorBrief: "Summary missing for this NOTAM.",
        });
        continue;
      }
      const plainEnglish = coerceString(row.plainEnglish);
      const operationalImpact = coerceString(row.operationalImpact);
      const pilotAction = coerceString(row.pilotAction);
      const sev: OperationalNotamSeverity = isSeverity(row.severity) ? row.severity : "caution";
      const aiCategory = normalizeCategory(row.aiCategory ?? row.category);

      if (!plainEnglish && !operationalImpact) {
        result.set(it.id, { decodeStatus: "error", decodeErrorBrief: "AI returned incomplete summary fields." });
        continue;
      }

      result.set(it.id, {
        decodeStatus: "ok",
        plainEnglish: plainEnglish || "—",
        operationalImpact: operationalImpact || "—",
        severity: sev,
        aiCategory,
        pilotAction: pilotAction || "—",
      });
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const brief =
      msg === "decode_timeout"
        ? "AI decode timed out."
        : err instanceof Error
          ? msg.slice(0, 200)
          : "AI decode unavailable.";
    console.warn("[notam-decode] Batch decode failed:", msg.slice(0, 280));
    return errorMap(items, brief);
  }
}
