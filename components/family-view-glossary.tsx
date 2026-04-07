import { AVIATION_GLOSSARY } from "@/lib/family-view/aviation-glossary";
import type { FamilyViewLang, FamilyViewStrings } from "@/lib/family-view/family-view-i18n";

type Props = {
  lang: FamilyViewLang;
  s: FamilyViewStrings;
};

export function FamilyViewGlossary({ lang, s }: Props) {
  const categories = AVIATION_GLOSSARY[lang];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E8E3DA] bg-[#F4F1EA]/50 p-4 sm:p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6F6F6F] mb-1">
          {s.glossaryTitle}
        </h2>
        <p className="text-xs text-[#9A9A9A]">
          {s.glossaryDescription}
        </p>
      </div>

      {categories.map((section) => (
        <section
          key={section.category}
          className="rounded-2xl border border-[#E8E3DA] bg-[#F4F1EA]/50 p-4 sm:p-5 shadow-sm"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6F6F6F] mb-3">
            {section.category}
          </h3>
          <div className="space-y-3">
            {section.terms.map((item) => (
              <div
                key={item.term}
                className="rounded-xl border border-[#E8E3DA] bg-white px-4 py-3"
              >
                <p className="font-semibold text-[#2F2F2F] text-sm">{item.term}</p>
                <p className="mt-1 text-xs text-[#6F6F6F] leading-relaxed">{item.definition}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
