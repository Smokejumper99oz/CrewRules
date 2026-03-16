"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle } from "lucide-react";

export function CheckoutStatusBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<null | { status: "success" | "cancel"; message: string }>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (!checkout) return;

    if (checkout === "success") {
      setBanner({
        status: "success",
        message: "Welcome to CrewRules™ Pro. Your subscription is active.",
      });
    }

    if (checkout === "cancel") {
      setBanner({
        status: "cancel",
        message: "Checkout was cancelled. No charges were made.",
      });
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("checkout");
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [searchParams, router, pathname]);

  if (!banner) return null;

  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm
        ${banner.status === "success" && "border-emerald-500 bg-emerald-600/20 text-emerald-300"}
        ${banner.status === "cancel" && "border-red-500 bg-red-600/20 text-red-300"}
      `}
    >
      {banner.status === "success" && <CheckCircle className="h-4 w-4 shrink-0" />}
      {banner.status === "cancel" && <XCircle className="h-4 w-4 shrink-0" />}
      <span className="min-w-0 flex-1">{banner.message}</span>
      <button
        type="button"
        onClick={() => setBanner(null)}
        className="ml-auto shrink-0 text-xs underline underline-offset-4 opacity-80 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  );
}
