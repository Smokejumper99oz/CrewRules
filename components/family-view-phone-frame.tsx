import type { ReactNode } from "react";
import { FamilyViewStatusBar } from "@/components/family-view-status-bar";

type Props = {
  children: ReactNode;
};

/**
 * Wraps Family View content in an iPhone-style frame on large desktop only.
 * On iPad, iPhone, and smaller screens, renders children without the frame.
 */
export function FamilyViewPhoneFrame({ children }: Props) {
  return (
    <div className="2xl:flex 2xl:justify-start 2xl:py-8 2xl:px-4">
      <div className="w-full 2xl:w-[780px] 2xl:rounded-[3rem] 2xl:border-[10px] 2xl:border-slate-700 2xl:bg-slate-700 2xl:p-2 2xl:shadow-2xl">
        <div
          className="2xl:rounded-2xl 2xl:overflow-hidden"
          data-family-view-frame
        >
          <div className="hidden 2xl:block 2xl:bg-[#F4F1EA]">
            <FamilyViewStatusBar />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
