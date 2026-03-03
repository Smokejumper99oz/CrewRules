"use client";

export function SessionExpireWarningModal({
  open,
  secondsLeft,
  onStay,
  onLogout,
}: {
  open: boolean;
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expire-title"
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-6 shadow-2xl ring-1 ring-white/5">
        <h2
          id="session-expire-title"
          className="text-lg font-semibold text-white"
        >
          Session expiring
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          For your security, you&apos;ll be signed out in{" "}
          <span className="font-medium text-emerald-300">{secondsLeft}s</span>{" "}
          due to inactivity.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            className="rounded-xl bg-[#75C043] px-4 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-95 transition touch-manipulation"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-slate-200 transition touch-manipulation"
          >
            Log out now
          </button>
        </div>
      </div>
    </div>
  );
}
