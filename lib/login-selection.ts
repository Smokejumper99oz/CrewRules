const STORAGE_KEY = "crewrules_login_selection";

export type LoginSelection = {
  role: "pilot" | "flight-attendant";
  airline: string;
};

export function saveLoginSelection(selection: LoginSelection): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  }
}

export function getLoginSelection(): LoginSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LoginSelection;
    if (parsed?.role && parsed?.airline) return parsed;
    return null;
  } catch {
    return null;
  }
}
