"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type DemoOpsShellView = "admin" | "pilot-preview";

export type PilotSubView =
  | "dashboard"
  | "my-profile"
  | "medical-certifications"
  | "documents"
  | "messages";

type DemoOpsViewContextValue = {
  view: DemoOpsShellView;
  setView: (view: DemoOpsShellView) => void;
  showAdminDashboard: () => void;
  showPilotProfilePreview: () => void;
  pilotSubView: PilotSubView;
  setPilotSubView: (sub: PilotSubView) => void;
  showPilotDashboard: () => void;
  showPilotMyProfile: () => void;
  /** Demo-only: pilot “Confirm & Save” on FAA medical upload review (James Wilson). */
  demoMedicalConfirmed: boolean;
  confirmDemoMedical: () => void;
  resetDemoMedical: () => void;
};

const DemoOpsViewContext = createContext<DemoOpsViewContextValue | null>(null);

export function DemoOpsViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<DemoOpsShellView>("admin");
  const [pilotSubView, setPilotSubViewState] = useState<PilotSubView>("dashboard");
  const [demoMedicalConfirmed, setDemoMedicalConfirmed] = useState(false);

  const setPilotSubView = useCallback((sub: PilotSubView) => {
    setPilotSubViewState(sub);
  }, []);

  const showAdminDashboard = useCallback(() => {
    setView("admin");
    setPilotSubViewState("dashboard");
  }, []);
  const showPilotProfilePreview = useCallback(() => {
    setView("pilot-preview");
    setPilotSubViewState("dashboard");
  }, []);
  const showPilotDashboard = useCallback(() => setPilotSubViewState("dashboard"), []);
  const showPilotMyProfile = useCallback(() => setPilotSubViewState("my-profile"), []);

  const confirmDemoMedical = useCallback(() => {
    setDemoMedicalConfirmed(true);
  }, []);

  const resetDemoMedical = useCallback(() => {
    setDemoMedicalConfirmed(false);
  }, []);

  const value = useMemo(
    () => ({
      view,
      setView,
      showAdminDashboard,
      showPilotProfilePreview,
      pilotSubView,
      setPilotSubView,
      showPilotDashboard,
      showPilotMyProfile,
      demoMedicalConfirmed,
      confirmDemoMedical,
      resetDemoMedical,
    }),
    [
      view,
      pilotSubView,
      setPilotSubView,
      showAdminDashboard,
      showPilotProfilePreview,
      showPilotDashboard,
      showPilotMyProfile,
      demoMedicalConfirmed,
      confirmDemoMedical,
      resetDemoMedical,
    ],
  );

  return <DemoOpsViewContext.Provider value={value}>{children}</DemoOpsViewContext.Provider>;
}

export function useDemoOpsView() {
  const ctx = useContext(DemoOpsViewContext);
  if (!ctx) {
    throw new Error("useDemoOpsView must be used within DemoOpsViewProvider");
  }
  return ctx;
}
