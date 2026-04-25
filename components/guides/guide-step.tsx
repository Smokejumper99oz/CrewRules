import type { ReactNode } from "react";

type Props = {
  step: number;
  title: string;
  children?: ReactNode;
};

export function GuideStep({ step, title, children }: Props) {
  return (
    <section className="scroll-mt-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: "#75C043" }}
        >
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {children ? <div className="mt-2 space-y-2 text-sm text-slate-700">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
