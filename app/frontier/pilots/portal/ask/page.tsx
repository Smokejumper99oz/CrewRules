import { Suspense } from "react";
import { getProfile } from "@/lib/profile";
import { AskPageContent } from "./ask-page-content";

const TENANT = "frontier";
const PORTAL = "pilots";

export default async function AskPage() {
  const profile = await getProfile();
  return (
    <Suspense fallback={<div className="animate-pulse rounded-2xl bg-slate-900/60 h-48" />}>
      <AskPageContent tenant={TENANT} portal={PORTAL} userId={profile?.id ?? null} />
    </Suspense>
  );
}
