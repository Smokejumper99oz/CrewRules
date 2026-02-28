"use client";

import { useEffect } from "react";

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

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-xl font-semibold text-rose-400 mb-2">Something went wrong</h1>
      <p className="text-slate-400 text-center max-w-md mb-4">
        An error occurred loading the portal. Check the browser console for details.
      </p>
      {process.env.NODE_ENV === "development" && (
        <pre className="text-xs text-slate-500 bg-slate-900 p-4 rounded-lg overflow-auto max-w-2xl mb-4">
          {error.message}
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
