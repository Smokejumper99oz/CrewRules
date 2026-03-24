"use client";

import { createClient } from "@/lib/supabase/client";
import { isIOS } from "@/lib/device";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SessionExpireWarningModal } from "@/components/session-expire-warning-modal";

const IDLE_MS = 30 * 60 * 1000; // 30 minutes
const WARN_MS = 60 * 1000; // warn 60 seconds before logout
const LOGIN_PATH = "/frontier/pilots/login";

export function DesktopIdleLogout() {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimerRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (isIOS()) return;

    function clearAllTimers() {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
        logoutTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    function doLogout() {
      clearAllTimers();
      setShowWarning(false);
      try {
        const supabase = createClient();
        supabase.auth.signOut();
      } catch {
        // Best-effort
      }
      router.replace(LOGIN_PATH);
      router.refresh();
    }

    function resetTimer() {
      clearAllTimers();
      setShowWarning(false);

      warningTimeoutRef.current = setTimeout(() => {
        setShowWarning(true);
        setSecondsLeft(60);
        countdownIntervalRef.current = setInterval(() => {
          setSecondsLeft((prev) => {
            if (prev <= 1) {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              doLogout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, IDLE_MS - WARN_MS);

      logoutTimeoutRef.current = setTimeout(doLogout, IDLE_MS);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        resetTimer();
      }
    }

    resetTimerRef.current = resetTimer;

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    resetTimer();

    return () => {
      // Clear all timers first (prevents callbacks from firing after unmount)
      clearAllTimers();
      // Remove all event listeners
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  function handleStay() {
    resetTimerRef.current();
  }

  function handleLogoutNow() {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setShowWarning(false);
    try {
      const supabase = createClient();
      supabase.auth.signOut();
    } catch {
      // Best-effort
    }
    router.replace(LOGIN_PATH);
    router.refresh();
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <SessionExpireWarningModal
      open={showWarning}
      secondsLeft={secondsLeft}
      onStay={handleStay}
      onLogout={handleLogoutNow}
    />,
    document.body
  );
}
