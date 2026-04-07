"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { PortalFeedbackModal, type FeedbackType } from "@/components/portal-feedback-modal";

/** Self-contained feedback button + modal for the admin layout header. */
export function AdminFeedbackButton() {
  const [open, setOpen] = useState(false);
  const [successKind, setSuccessKind] = useState<FeedbackType | null>(null);

  const handleSubmitted = (kind: FeedbackType) => {
    setSuccessKind(kind);
    setTimeout(() => setSuccessKind(null), 5000);
  };

  return (
    <>
      <PortalFeedbackModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmitted={handleSubmitted}
      />
      <div className="flex items-center gap-2">
        {successKind !== null && (
          <span className="hidden sm:block text-xs text-[#75C043]">
            Thanks for the feedback!
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex touch-manipulation items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition min-h-[44px]"
          aria-label="Send feedback"
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-[#75C043]" aria-hidden />
          <span className="hidden sm:inline">Feedback</span>
        </button>
      </div>
    </>
  );
}
