import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * Wraps Family View content in an iPhone-style frame on large desktop only.
 * On iPad, iPhone, and smaller screens, renders children without the frame.
 */
export function FamilyViewPhoneFrame({ children }: Props) {
  return (
    <div className="2xl:flex 2xl:justify-center 2xl:py-8 2xl:px-4">
      <div className="w-full 2xl:w-[390px] 2xl:rounded-[3rem] 2xl:border-[10px] 2xl:border-slate-700 2xl:bg-slate-700 2xl:p-2 2xl:shadow-2xl">
        {children}
      </div>
    </div>
  );
}
