"use client";

import { useState } from "react";
import { demo135OpsSignOut } from "../actions";

export function DemoOpsSignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <form action={demo135OpsSignOut}>
      <button
        type="submit"
        disabled={pending}
        onClick={() => setPending(true)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
      >
        Sign out
      </button>
    </form>
  );
}
