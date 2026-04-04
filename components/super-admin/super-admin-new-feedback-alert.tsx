import Link from "next/link";
import { MessageSquare } from "lucide-react";

type Props = {
  count: number;
};

export function SuperAdminNewFeedbackAlert({ count }: Props) {
  if (count <= 0) return null;

  const label =
    count === 1
      ? "1 new feedback submission awaiting review"
      : `${count} new feedback submissions awaiting review`;

  return (
    <div className="rounded-xl border border-amber-400/35 bg-amber-500/5 px-4 py-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <MessageSquare className="size-5 shrink-0 text-amber-300/90" aria-hidden />
        <p className="text-sm font-medium text-slate-100">{label}</p>
      </div>
      <Link
        href="/super-admin/feedback"
        className="shrink-0 rounded-lg bg-[#75C043] px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-95 transition-opacity"
      >
        Open Feedback
      </Link>
    </div>
  );
}
