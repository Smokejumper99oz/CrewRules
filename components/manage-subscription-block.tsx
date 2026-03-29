"use client";

import { useState } from "react";
import type { Profile } from "@/lib/profile";

export type ManageSubscriptionProfilePick = Pick<
  Profile,
  | "stripe_customer_id"
  | "subscription_tier"
  | "billing_source"
  | "billing_interval"
  | "current_period_end"
  | "cancel_at_period_end"
>;

export function canManageStripeSubscription(profile: ManageSubscriptionProfilePick | null | undefined): boolean {
  return (
    Boolean(profile?.stripe_customer_id) &&
    ((profile?.subscription_tier ?? "free") === "pro" || profile?.billing_source === "stripe")
  );
}

/** Billing interval + Stripe Customer Portal — same behavior as Profile > Account. */
export function ManageSubscriptionBlock({ profile }: { profile: ManageSubscriptionProfilePick | null | undefined }) {
  const [portalLoading, setPortalLoading] = useState(false);

  if (!canManageStripeSubscription(profile)) return null;

  return (
    <div>
      <span className="text-xs font-medium text-slate-500">Subscription</span>
      {(profile?.billing_interval || profile?.current_period_end || profile?.cancel_at_period_end) && (
        <p className="mt-0.5 text-xs text-slate-400">
          {profile?.billing_interval && <span className="capitalize">{profile.billing_interval}</span>}
          {profile?.current_period_end && (
            <span>
              {profile?.billing_interval && " · "}
              {profile?.cancel_at_period_end
                ? `Access until ${new Date(profile.current_period_end).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}`
                : `Renews ${new Date(profile.current_period_end).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}`}
            </span>
          )}
          {profile?.cancel_at_period_end && (
            <span className="text-amber-400/90"> · Cancels at period end</span>
          )}
        </p>
      )}
      <button
        type="button"
        onClick={async () => {
          setPortalLoading(true);
          try {
            const res = await fetch("/api/stripe/portal", { method: "POST" });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else setPortalLoading(false);
          } catch {
            setPortalLoading(false);
          }
        }}
        disabled={portalLoading}
        className="mt-2 text-sm text-[#75C043] hover:text-[#75C043]/80 font-medium disabled:opacity-50"
      >
        {portalLoading ? "Opening…" : "Manage subscription"}
      </button>
    </div>
  );
}
