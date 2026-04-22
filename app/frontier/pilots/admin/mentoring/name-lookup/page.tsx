import { FrontierPilotAdminMentorNameLookup } from "@/components/admin/frontier-pilot-admin-mentor-name-lookup";

export const dynamic = "force-dynamic";

const sectionCard = "rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-sm";

export default function FrontierPilotAdminMentoringNameLookupPage() {
  return (
    <div className="space-y-6">
      <h1 className="border-b border-slate-200 pb-3 text-xl font-semibold tracking-tight text-[#1a2b4b]">
        Frontier Airlines Employee Number Lookup
      </h1>

      <section className={sectionCard} aria-labelledby="mentor-name-lookup-heading">
        <h2 id="mentor-name-lookup-heading" className="text-base font-semibold text-slate-800">
          Match Names to Employee Numbers
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-snug text-slate-600">
          Quickly prepare Mentee Import files with a clean, copy-paste-ready format. Names are matched against
          the{" "}
          <span className="whitespace-nowrap">
            Crew<span className="font-semibold text-[#75C043]">Rules</span>™
          </span>{" "}
          pilot directory, and duplicate entries are automatically flagged.
        </p>
        <div className="mt-4">
          <FrontierPilotAdminMentorNameLookup />
        </div>
      </section>
    </div>
  );
}
