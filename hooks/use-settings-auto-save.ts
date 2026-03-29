"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 650;
const SAVED_DISPLAY_MS = 2200;

type SaveResult = { ok: true } | { ok: false; error?: string };

type SaveFn = (form: HTMLFormElement) => Promise<SaveResult>;

export type SettingsAutoSaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Reusable auto-save helper for settings-style forms that still post via a single FormData snapshot.
 * - scheduleDebouncedSave: text typing (coalesced)
 * - saveNow: dropdowns / committed values (flush pending debounce first)
 */
export function useSettingsAutoSave(
  formRef: React.RefObject<HTMLFormElement | null>,
  saveFn: SaveFn,
  onSuccess?: () => void,
) {
  const [status, setStatus] = useState<SettingsAutoSaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const runSave = useCallback(async () => {
    const form = formRef.current;
    if (!form) return;

    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }

    inFlightRef.current = true;
    pendingRef.current = false;
    setStatus("saving");
    setErrorMessage(null);

    let result: SaveResult;
    try {
      result = await saveFn(form);
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message : "Couldn’t save changes",
      };
    } finally {
      inFlightRef.current = false;
    }

    if (!result.ok) {
      setStatus("error");
      setErrorMessage(result.error?.trim() || "Couldn’t save changes");
    } else {
      setStatus("saved");
      setErrorMessage(null);
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current);
      savedHideTimerRef.current = setTimeout(() => {
        setStatus("idle");
        savedHideTimerRef.current = null;
      }, SAVED_DISPLAY_MS);
    }

    if (pendingRef.current) {
      pendingRef.current = false;
      queueMicrotask(() => {
        void runSave();
      });
    } else if (result.ok) {
      onSuccess?.();
    }
  }, [formRef, saveFn, onSuccess]);

  const scheduleDebouncedSave = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void runSave();
    }, DEBOUNCE_MS);
  }, [runSave]);

  const saveNow = useCallback(() => {
    clearDebounce();
    void runSave();
  }, [clearDebounce, runSave]);

  useEffect(
    () => () => {
      clearDebounce();
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current);
    },
    [clearDebounce],
  );

  return { status, errorMessage, scheduleDebouncedSave, saveNow };
}
