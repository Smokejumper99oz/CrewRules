import { logSystemEvent } from "@/lib/system-events";

/** Substrings (matched case-insensitively) for Next/React dev overlay / RSC bundler noise — do not persist to system_events. */
const FRAMEWORK_NOISE_SUBSTRINGS = [
  "SegmentViewNode",
  "React Client Manifest",
  "React Server Components bundler",
  "next/dist/client/devtools",
  "/_app",
] as const;

function shouldSuppressFrameworkNoiseForSystemEvents(
  err: Error,
  metadata: Record<string, unknown>
): boolean {
  const parts: string[] = [err.message];
  if (err.stack) parts.push(err.stack);
  const metaStack = metadata.stack;
  if (typeof metaStack === "string") parts.push(metaStack);
  const haystack = parts.join("\n").toLowerCase();
  return FRAMEWORK_NOISE_SUBSTRINGS.some((s) => haystack.includes(s.toLowerCase()));
}

/**
 * Log server errors to console for debugging.
 * Helps diagnose 500s on routes like /frontier/pilots/portal.
 */
export async function onRequestError(
  err: Error & { digest?: string },
  request: { path: string; method: string },
  context: { routePath: string; routeType: string; renderSource?: string }
) {
  console.error("[Server Error]", {
    message: err.message,
    digest: err.digest,
    stack: err.stack,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });

  const metadata: Record<string, unknown> = {
    path: request.path,
    method: request.method,
  };
  if (err.stack) {
    metadata.stack = err.stack;
  }

  // Omit known Next/React dev overlay / RSC bundler noise from system_events (any NODE_ENV).
  // Non-production: avoids flooding a shared DB during local dev; production: keeps Needs Attention useful.
  if (shouldSuppressFrameworkNoiseForSystemEvents(err, metadata)) {
    return;
  }

  await logSystemEvent({
    type: "error",
    severity: "error",
    title: "Server request error",
    message: err.message,
    metadata,
  });
}
