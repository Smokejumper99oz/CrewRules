"use client";

import { useEffect } from "react";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "[object Event]" || error.message === "[object PointerEvent]") {
      return "Something went wrong—often a stale UI action. Try again or refresh the page.";
    }
    return error.message;
  }
  if (typeof Event !== "undefined" && error instanceof Event) {
    return "Something went wrong—often a stale UI action. Try again or refresh the page.";
  }
  const str = String(error);
  if (str === "[object Event]" || str === "[object PointerEvent]") {
    return "A network or unexpected error occurred.";
  }
  return str || "An unexpected error occurred.";
}

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Portal error:", error);
  }, [error]);

  const message = getErrorMessage(error);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-xl font-semibold text-rose-400 mb-2">Something went wrong</h1>
      <p className="text-slate-400 text-center max-w-md mb-4">
        An error occurred loading the portal. Check the browser console for details.
      </p>
      {process.env.NODE_ENV === "development" && (
        <pre className="text-xs text-slate-500 bg-slate-900 p-4 rounded-lg overflow-auto max-w-2xl mb-4">
          {message}
        </pre>
      )}
      <button
        onClick={reset}
        className="rounded-lg bg-[#75C043] px-4 py-2 text-sm font-medium text-slate-950 hover:bg-[#75C043]/90"
      >
        Try again
      </button>
    </div>
  );
}
