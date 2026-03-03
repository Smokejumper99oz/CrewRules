"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const LOGIN_PATH = "/frontier/pilots/login";

export function SignOutButton({
  signOut,
  className,
  buttonClassName,
  children,
  role,
}: {
  signOut: () => Promise<void>;
  className?: string;
  buttonClassName?: string;
  children: React.ReactNode;
  role?: string;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await signOut();
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Best-effort: clear browser storage; ignore errors
    }
    router.push(LOGIN_PATH);
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <button
        type="submit"
        disabled={pending}
        role={role}
        className={buttonClassName ?? "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/5 transition touch-manipulation disabled:opacity-50"}
      >
        {children}
      </button>
    </form>
  );
}
