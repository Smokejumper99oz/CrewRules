import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { runCommuteConflictAlerts } from "@/lib/cron/run-commute-conflict-alerts";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return authHeader === `Bearer ${expected}`;
}

type DailySubJobResult = {
  job: string;
  ok: boolean;
  durationMs: number;
  /** Sub-job-specific payload (counts, placeholder flags, errors). */
  result?: Record<string, unknown>;
};

/**
 * v1 placeholder: trial reminder sending stays on `/api/cron/trial-reminders` until wired here.
 */
async function runTrialRemindersJob(): Promise<DailySubJobResult> {
  const started = performance.now();
  console.log("[daily-jobs] sub-job start: trial-reminders (placeholder)");
  const payload = {
    mode: "placeholder" as const,
    message: "Not consolidated yet; continue using /api/cron/trial-reminders until shared runner is extracted.",
  };
  console.log("[daily-jobs] sub-job end: trial-reminders", payload);
  return {
    job: "trial-reminders",
    ok: true,
    durationMs: Math.round(performance.now() - started),
    result: payload,
  };
}

/**
 * v1 placeholder: signup nudge stays on `/api/cron/signup-nudge` until wired here.
 */
async function runSignupNudgeJob(): Promise<DailySubJobResult> {
  const started = performance.now();
  console.log("[daily-jobs] sub-job start: signup-nudge (placeholder)");
  const payload = {
    mode: "placeholder" as const,
    message: "Not consolidated yet; continue using /api/cron/signup-nudge until shared runner is extracted.",
  };
  console.log("[daily-jobs] sub-job end: signup-nudge", payload);
  return {
    job: "signup-nudge",
    ok: true,
    durationMs: Math.round(performance.now() - started),
    result: payload,
  };
}

async function runCommuteConflictAlertsJob(): Promise<DailySubJobResult> {
  const started = performance.now();
  console.log("[daily-jobs] sub-job start: commute-conflict-alerts");
  const commuteResult = await runCommuteConflictAlerts();
  const sub: DailySubJobResult = {
    job: "commute-conflict-alerts",
    ok: commuteResult.ok,
    durationMs: Math.round(performance.now() - started),
    result: commuteResult,
  };
  console.log("[daily-jobs] sub-job end: commute-conflict-alerts", commuteResult);
  return sub;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = randomUUID();
  const jobStarted = performance.now();
  console.log("[daily-jobs] start", { runId, path: "/api/cron/daily-jobs" });

  const results: DailySubJobResult[] = [];

  try {
    results.push(await runTrialRemindersJob());
    results.push(await runSignupNudgeJob());
    results.push(await runCommuteConflictAlertsJob());
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[daily-jobs] fatal error", { runId, error: err });
    const durationMs = Math.round(performance.now() - jobStarted);
    console.log("[daily-jobs] end", { runId, ok: false, durationMs, results });
    return NextResponse.json(
      {
        ok: false,
        runId,
        durationMs,
        error: err,
        results,
      },
      { status: 500 }
    );
  }

  const durationMs = Math.round(performance.now() - jobStarted);
  const ok = results.every((r) => r.ok);
  console.log("[daily-jobs] end", { runId, ok, durationMs, results });

  return NextResponse.json({
    ok,
    runId,
    durationMs,
    results,
  });
}
