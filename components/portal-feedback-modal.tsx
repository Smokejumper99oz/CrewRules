"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { submitFeedback } from "@/app/frontier/pilots/portal/feedback/actions";

const MAX_SCREENSHOTS = 4;
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

/** MIME types browsers may report for PNG / JPEG / WebP screenshots (incl. progressive JPEG). */
const ALLOWED_SCREENSHOT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/pjpeg",
  "image/jpg",
]);

function isAllowedScreenshotFile(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  if (ALLOWED_SCREENSHOT_TYPES.has(mime)) return true;
  const name = file.name.trim().toLowerCase();
  return /\.(png|jpe?g|webp)$/.test(name);
}

function validateScreenshotList(files: File[]): string | null {
  if (files.length > MAX_SCREENSHOTS) {
    return `At most ${MAX_SCREENSHOTS} screenshots`;
  }
  for (const f of files) {
    if (f.size === 0) {
      return "Screenshot file is empty";
    }
    if (f.size > MAX_SCREENSHOT_BYTES) {
      return "Each screenshot must be 10 MB or smaller";
    }
    if (!isAllowedScreenshotFile(f)) {
      return "Screenshots must be PNG, JPEG, or WebP (.png, .jpg, .jpeg, .webp).";
    }
  }
  return null;
}

export type FeedbackType = "bug" | "feature" | "feedback";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitted: (feedbackType: FeedbackType) => void;
};

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "feedback", label: "Feedback" },
];

export function PortalFeedbackModal({ open, onClose, onSubmitted }: Props) {
  const pathname = usePathname();
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType("feedback");
      setMessage("");
      setScreenshots([]);
      setError(null);
      setPending(false);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (pending) return;
    onClose();
  }, [pending, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, pending, handleClose]);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (pending) return;
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;

    setError(null);

    if (screenshots.length + picked.length > MAX_SCREENSHOTS) {
      setError(
        `You can add at most ${MAX_SCREENSHOTS} screenshots total. Remove one or choose fewer files.`
      );
      return;
    }

    const combined = [...screenshots, ...picked];
    const err = validateScreenshotList(combined);
    if (err) {
      setError(err);
      return;
    }
    setScreenshots(combined);
  };

  const removeScreenshotAt = (index: number) => {
    if (pending) return;
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || pending) return;

    const listErr = validateScreenshotList(screenshots);
    if (listErr) {
      setError(listErr);
      return;
    }

    setPending(true);
    setError(null);

    const routePath = pathname ?? "";
    const clientContext =
      typeof window !== "undefined"
        ? {
            userAgent: navigator.userAgent,
            language: navigator.language,
            viewport: { width: window.innerWidth, height: window.innerHeight },
          }
        : { userAgent: "", language: "", viewport: { width: 0, height: 0 } };

    const result = await submitFeedback({
      feedback_type: type,
      message: trimmed,
      route_path: routePath || null,
      client_context: clientContext,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
    });

    setPending(false);

    if (result.success) {
      setScreenshots([]);
      onSubmitted(type);
      onClose();
      return;
    }

    setError(result.error);
  };

  const isDisabled = pending;
  const canSubmit = !pending && message.trim().length > 0;

  const screenshotPickerSummary =
    screenshots.length === 0
      ? "No screenshots selected"
      : screenshots.length === 1
        ? "1 screenshot selected"
        : `${screenshots.length} screenshots selected`;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-feedback-modal-title"
    >
      <button
        type="button"
        aria-label="Close feedback dialog"
        className="absolute inset-0 cursor-default"
        onClick={handleClose}
        disabled={isDisabled}
      />
      <div
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto sidebar-scrollbar-hide rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950/95 shadow-2xl shadow-black/40 ring-1 ring-white/5 [html[data-theme=light]_&]:border-slate-200 [html[data-theme=light]_&]:from-white [html[data-theme=light]_&]:to-slate-50 [html[data-theme=light]_&]:ring-slate-200/60"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={isDisabled}
          className="absolute right-4 top-4 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent [html[data-theme=light]_&]:text-slate-500 [html[data-theme=light]_&]:hover:bg-slate-100 [html[data-theme=light]_&]:hover:text-slate-900"
          aria-label="Close"
        >
          {pending ? <Loader2 size={20} className="animate-spin" /> : <X size={20} />}
        </button>

        <form
          onSubmit={handleSubmit}
          className="px-6 pt-14 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:px-8 sm:pt-14 sm:pb-[calc(2rem+env(safe-area-inset-bottom,0px))]"
        >
          <h2
            id="portal-feedback-modal-title"
            className="text-2xl font-bold text-slate-900 dark:text-white"
          >
            Send Feedback
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Tell us what broke, what would help, or anything else. We read every submission.
          </p>

          <fieldset className="mt-6 space-y-2">
            <legend className="text-sm font-medium text-slate-800 dark:text-slate-200">Type</legend>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const selected = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => !isDisabled && setType(opt.value)}
                    disabled={isDisabled}
                    className={[
                      "min-h-[44px] touch-manipulation rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                      selected
                        ? "border-[#75C043] bg-[#75C043]/15 text-slate-900 dark:text-white ring-1 ring-[#75C043]/40"
                        : "border-slate-200 bg-slate-100/80 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-white/20",
                      isDisabled ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Message{" "}
              <span className="text-red-600 dark:text-red-400" aria-hidden>
                *
              </span>
            </span>
            <textarea
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              disabled={isDisabled}
              rows={5}
              placeholder="What happened or what would you like to see?"
              className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#75C043]/50 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:placeholder:text-slate-500 disabled:opacity-60"
            />
          </label>

          <div className="mt-5">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Screenshots <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
            </span>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              PNG, JPG, or WebP • up to 4 files • 10 MB each
            </p>
            <input
              ref={screenshotInputRef}
              id="portal-feedback-screenshot-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={isDisabled || screenshots.length >= MAX_SCREENSHOTS}
              onChange={handleFileChange}
              className="sr-only"
              tabIndex={-1}
            />
            <div className="mt-2 flex min-h-[44px] flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isDisabled || screenshots.length >= MAX_SCREENSHOTS}
                onClick={() => screenshotInputRef.current?.click()}
                className="inline-flex touch-manipulation items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-slate-800/70"
                aria-controls="portal-feedback-screenshot-input"
              >
                <ImagePlus className="size-4 shrink-0 text-[#75C043]" aria-hidden />
                Add screenshots
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400">{screenshotPickerSummary}</span>
            </div>
            {screenshots.length > 0 && (
              <>
                <ul className="mt-3 space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
                  {screenshots.map((f, i) => (
                    <li
                      key={`${f.name}-${f.size}-${i}`}
                      className="flex min-h-[44px] items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-slate-800 dark:text-slate-200" title={f.name}>
                        {f.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeScreenshotAt(i)}
                        disabled={isDisabled}
                        className="inline-flex min-h-[44px] shrink-0 touch-manipulation items-center justify-center rounded-lg px-3 text-xs font-medium leading-none text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 disabled:opacity-50 active:bg-slate-200/90 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDisabled}
              className="min-h-[44px] touch-manipulation rounded-xl border border-slate-200 bg-slate-100/80 px-5 py-3 text-sm font-medium text-slate-800 hover:border-slate-300 transition dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:border-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="min-h-[44px] touch-manipulation rounded-xl bg-[#75C043] px-5 py-3 text-sm font-semibold text-slate-950 hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50"
            >
              {pending ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </span>
              ) : (
                "Submit"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
