import { logSystemEvent } from "@/lib/system-events";

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

  await logSystemEvent({
    type: "error",
    severity: "error",
    title: "Server request error",
    message: err.message,
    metadata,
  });
}
