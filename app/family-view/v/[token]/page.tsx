import type { Metadata } from "next";
import { FamilyViewScheduleContent } from "@/components/family-view-schedule-content";
import {
  resolveFamilyViewViewerByRawToken,
  fetchTrainingCityForPilotUserId,
} from "@/lib/family-view/viewer-resolve";
import { getCommuteFlights } from "@/app/frontier/pilots/portal/commute/actions";

export const metadata: Metadata = {
  title: "Family View · CrewRules™",
  description: "A read-only shared view of a crew member’s schedule.",
  robots: { index: false, follow: false },
};

function ViewerFallback({ variant }: { variant: "invalid" | "unavailable" }) {
  const title = variant === "invalid" ? "Link not valid" : "Not available";
  const body =
    variant === "invalid"
      ? "This link is invalid or has expired. Ask your crew member for a new invite if you still need access."
      : "This shared schedule isn’t available right now. Ask your crew member to send a new invite if you still need access.";

  return (
    <main className="min-h-screen bg-[#F7F6F2] text-[#2F2F2F]">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-16">
        <div className="rounded-[28px] border border-[#E8E3DA] bg-white p-8 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6F6F6F]">CrewRules™ Family View</p>
          <h1 className="mt-3 text-xl font-semibold text-[#2F4F46]">{title}</h1>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-[#4A4A4A]">{body}</p>
        </div>
      </div>
    </main>
  );
}

export default async function FamilyViewPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ tab?: string; lang?: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveFamilyViewViewerByRawToken(token);

  if (!resolved.ok) {
    return <ViewerFallback variant={resolved.reason === "invalid" ? "invalid" : "unavailable"} />;
  }

  const { profile, events, displaySettings } = resolved;
  const pathPrefix = `/family-view/v/${encodeURIComponent(token)}`;

  return (
    <FamilyViewScheduleContent
      profile={profile}
      displaySettings={displaySettings}
      events={events}
      searchParams={searchParams}
      pathPrefix={pathPrefix}
      showSharingDisabledCallout={false}
      viewerReadOnlyBanner
      fetchTrainingCity={(title, start, end) =>
        fetchTrainingCityForPilotUserId(profile.id, profile.base_airport, title, start, end)
      }
      fetchCommuteFlights={async () =>
        ({
          ok: false as const,
          reason: "unavailable" as const,
          message: "Live flight status is not available on shared links.",
        }) as Awaited<ReturnType<typeof getCommuteFlights>>
      }
    />
  );
}
