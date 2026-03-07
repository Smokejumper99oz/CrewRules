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
}
