"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CrewSplashScreen, SPLASH_START_KEY } from "@/components/crew-splash-screen";

const MIN_SPLASH_MS = 700;
const SPLASH_FADE_OUT_MS = 250;
const PORTAL_FADE_IN_MS = 400;
const SPLASH_SEEN_KEY = "crewrules-portal-splash-seen";

type Stage = "splash" | "crossfade" | "portal";

export function PortalFadeIn({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("splash");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const alreadySeen = sessionStorage.getItem(SPLASH_SEEN_KEY);
      if (alreadySeen === "1") {
        setStage("portal");
        return;
      }
      // Set immediately so any remount (nav, Strict Mode) will skip splash
      sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    }

    let storedEpoch = 0;
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(SPLASH_START_KEY);
      if (stored) {
        storedEpoch = parseInt(stored, 10);
      }
      if (!storedEpoch) {
        storedEpoch = Date.now();
        sessionStorage.setItem(SPLASH_START_KEY, String(storedEpoch));
      }
    }
    const elapsed = Date.now() - storedEpoch;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);

    const t1 = setTimeout(() => {
      sessionStorage.removeItem(SPLASH_START_KEY);
      setStage("crossfade");
    }, remaining);

    const t2 = setTimeout(() => {
      setStage("portal");
    }, remaining + PORTAL_FADE_IN_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (stage === "splash") {
    return <CrewSplashScreen staticMode />;
  }

  return (
    <>
      {stage === "crossfade" && (
        <CrewSplashScreen staticMode fadeOut />
      )}
      <PortalContentFadeIn
        durationMs={PORTAL_FADE_IN_MS}
        visible={stage === "crossfade" || stage === "portal"}
      >
        {children}
      </PortalContentFadeIn>
    </>
  );
}

function PortalContentFadeIn({
  children,
  durationMs,
  visible,
}: {
  children: ReactNode;
  durationMs: number;
  visible: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  return (
    <div
      className="ease-out"
      style={{
        opacity: mounted ? 1 : 0,
        transition: `opacity ${durationMs}ms ease-out`,
      }}
    >
      {children}
    </div>
  );
}
