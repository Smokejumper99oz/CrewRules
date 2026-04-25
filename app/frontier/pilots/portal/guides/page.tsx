import Link from "next/link";

const GUIDE_CARD_LINK_CLASS =
  "block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#75C043]/40 hover:shadow-md dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-[#75C043]/35";

type GuideCard = {
  href: string;
  title: string;
  description: string;
};

const SECTIONS: { title: string; items: readonly GuideCard[] }[] = [
  {
    title: "Getting Started",
    items: [
      {
        href: "/frontier/pilots/portal/guides/commute-assist-alerts",
        title: "Commute Assist™ Alerts",
        description:
          "Learn how CrewRules™ alerts you when no safe same-day commute is available.",
      },
    ],
  },
  {
    title: "Commute Assist™",
    items: [
      {
        href: "/frontier/pilots/portal/guides/commute-assist-buffers",
        title: "Commute Assist™ Buffers",
        description:
          "Understand how arrival buffers work and how CrewRules™ determines safe commute timing.",
      },
    ],
  },
  {
    title: "Mentoring",
    items: [
      {
        href: "/frontier/pilots/portal/guides/mentoring-overview",
        title: "Mentoring Program Overview",
        description: "Learn how mentoring works, how to connect, and how to track progress.",
      },
    ],
  },
];

export default function GuidesLandingPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Guides</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Step-by-step help for CrewRules™ features.
        </p>
      </div>
      {SECTIONS.map((section, sectionIndex) => (
        <section key={section.title} className={sectionIndex > 0 ? "mt-8" : undefined}>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{section.title}</h3>
          <ul className="mt-4 space-y-4">
            {section.items.map((g) => (
              <li key={g.href}>
                <Link href={g.href} className={GUIDE_CARD_LINK_CLASS}>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{g.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{g.description}</p>
                  <span className="mt-3 inline-block text-sm font-medium text-[#75C043]">Open guide →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
