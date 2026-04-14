import type { MentorEmailDetailRow } from "@/lib/mentoring/mentor-email-detail-rows";

function formatClassCell(classDate: string | null): string {
  if (classDate == null || !String(classDate).trim()) return "—";
  const s = String(classDate).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "/");
  return String(classDate).trim();
}

function formatSentOpened(iso: string | null): string {
  if (iso == null || !String(iso).trim()) return "—";
  const d = new Date(String(iso).trim());
  if (Number.isNaN(d.getTime())) return "—";
  const local = d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const utcH = d.getUTCHours();
  const utcM = d.getUTCMinutes();
  const utcTime = `${String(utcH).padStart(2, "0")}:${String(utcM).padStart(2, "0")} UTC`;
  return `${local} (${utcTime})`;
}

function statusPillClass(status: MentorEmailDetailRow["status"]): string {
  if (status === "opened") {
    return "inline-flex min-w-[4.5rem] items-center justify-center rounded-md border border-emerald-600/40 bg-emerald-50 px-2 py-0.5 text-center text-xs font-medium capitalize text-emerald-900";
  }
  return "inline-flex min-w-[4.5rem] items-center justify-center rounded-md border border-amber-600/40 bg-amber-50 px-2 py-0.5 text-center text-xs font-medium capitalize text-amber-900";
}

type Props = {
  rows: MentorEmailDetailRow[];
};

/**
 * Assignment-level mentor notification email log (one row per Resend message).
 * Rendered on Mentoring Email Center; linked from admin dashboard “View Pending”.
 */
export function MentoringEmailAcknowledgementDetailSection({ rows }: Props) {
  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No assignment email activity yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Class</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Mentor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Mentee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Sent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Opened</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {rows.map((r) => (
                <tr key={r.resendEmailId} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 tabular-nums text-slate-900">
                    {r.classDate != null && String(r.classDate).trim() !== ""
                      ? formatClassCell(r.classDate)
                      : "—"}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-900" title={r.mentorName}>
                    {r.mentorName}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-900" title={r.menteeName}>
                    {r.menteeName}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-slate-800" title={r.email}>
                    {r.email || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{formatSentOpened(r.sentAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{formatSentOpened(r.openedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={statusPillClass(r.status)}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
