type Props = {
  title: string;
  description: string;
};

export function PortalSettingsPlaceholder({ title, description }: Props) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <h2 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg dark:text-white">{title}</h2>
      <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">{description}</p>
      <p className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500 sm:mt-6 sm:px-4 sm:py-8 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
        Coming next — settings for this section will appear here.
      </p>
    </div>
  );
}
