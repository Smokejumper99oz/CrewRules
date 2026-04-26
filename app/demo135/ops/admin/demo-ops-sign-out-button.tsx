"use client";

import { useState } from "react";
import { demo135OpsSignOut } from "../actions";

export function DemoOpsSignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <form action={demo135OpsSignOut} className="relative z-10 block">
      <button
        type="submit"
        disabled={pending}
        onClick={() => setPending(true)}
        className="w-full rounded-sm px-3 py-2.5 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
      >
        Sign out
      </button>
    </form>
  );
}
