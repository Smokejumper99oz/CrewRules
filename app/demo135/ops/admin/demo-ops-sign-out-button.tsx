"use client";

import { SignOutButton } from "@/components/sign-out-button";
import { demo135OpsSignOut } from "../actions";

export function DemoOpsSignOutButton() {
  return (
    <SignOutButton
      signOut={demo135OpsSignOut}
      afterSignOutHref="/cr135/login"
      className="relative z-10 block"
      buttonClassName="w-full rounded-sm px-3 py-2.5 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
    >
      Sign out
    </SignOutButton>
  );
}
