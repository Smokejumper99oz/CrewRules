import type { ReactNode } from "react";

type Props = {
  documentTitle: string;
  children: ReactNode;
};

/**
 * In-app guide chrome aligned with `lib/email/crewrules-transactional-email-html.ts`
 * (dark header, green rule, white body, dark footer).
 */
export function CrewrulesGuideShell({ documentTitle, children }: Props) {
  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:border-slate-600 dark:shadow-black/50">
        <header className="bg-[#0c111e] px-5 pb-3.5 pt-[18px]">
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/crewrules-logo.png"
              alt="CrewRules™"
              width={300}
              className="h-auto max-w-[min(100%,300px)]"
            />
          </div>
          <div className="mt-3.5 h-[3px] rounded-full bg-[#75C043]" />
        </header>
        <div className="bg-white px-6 py-7 text-slate-900 sm:px-7 [html[data-theme=dark]_&]:bg-white [html[data-theme=dark]_&]:text-slate-900">
          <h1 className="text-xl font-semibold leading-snug text-slate-900">{documentTitle}</h1>
          <div className="mt-6 space-y-8 text-base leading-relaxed text-slate-800">{children}</div>
        </div>
        <footer className="bg-[#0c111e] px-5 py-3.5">
          <p className="text-center text-xs leading-relaxed text-slate-300">
            <span className="font-normal text-white">Crew</span>
            <span className="font-normal text-[#75C043]">Rules</span>
            <span className="align-super text-[10px] font-normal text-white">™</span>
            <span className="text-slate-300"> — The Smart Knowledge Platform for Airline Crew</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
