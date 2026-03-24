"use client";

import { useEffect } from "react";

export type ColorMode = "dark" | "light" | "system";

function resolveTheme(mode: ColorMode): "dark" | "light" {
  if (mode === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode === "light" ? "light" : "dark";
}

type ThemeProviderProps = {
  initialTheme?: ColorMode;
  children: React.ReactNode;
};

export function ThemeProvider({ initialTheme = "dark", children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: ColorMode) => {
      const resolved = resolveTheme(mode);
      root.setAttribute("data-theme", resolved);
      root.style.colorScheme = resolved;
    };

    apply(initialTheme);

    if (initialTheme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handle = () => apply("system");
      mq.addEventListener("change", handle);
      return () => mq.removeEventListener("change", handle);
    }
  }, [initialTheme]);

  return <>{children}</>;
}
