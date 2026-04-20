"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { setTrainingDeviation } from "@/app/frontier/pilots/portal/schedule/actions";

type Props = {
  eventId: string;
  trainingCityIata: string | null;
  trainingCityDisplay: string | null;
  homeAirport: string | null;
  homeCity: string | null;
};

export function TrainingDeviationPrompt({
  eventId,
  trainingCityIata,
  trainingCityDisplay,
  homeAirport,
  homeCity,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cityLabel = trainingCityDisplay ?? trainingCityIata ?? "training";
  const homeLabel = homeCity ?? homeAirport ?? "your home airport";

  async function handleChoice(deviate: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setTrainingDeviation(eventId, deviate);
      if (!result.ok) {
        setError(result.error ?? "Failed to save preference");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/[0.08]">
      <div className="flex items-start gap-2.5">
        <GraduationCap className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Recurrent Training in {cityLabel} — How are you getting there?
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Company provides travel from your crew base. If you&apos;re flying from {homeLabel} instead, Commute Assist will show you flights to {cityLabel}.
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              onClick={() => handleChoice(true)}
              disabled={isPending}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              Flying from {homeLabel}
            </button>
            <button
              onClick={() => handleChoice(false)}
              disabled={isPending}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-500/40 dark:bg-transparent dark:text-amber-300"
            >
              Using company travel
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
