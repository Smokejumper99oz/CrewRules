"use client";

import { useEffect } from "react";

export type ColorMode = "dark" | "light" | "system";

function resolveTheme(mode: ColorMode): "dark" | "light" {
  // Must match app/layout.tsx: cookie "system" keeps data-theme="dark" on SSR.
  // Resolving system from prefers-color-scheme here produced light on iPad while
  // the shell was authored dark-first, so sidebars fell back to bg-white / light UI.
  if (mode === "system") {
    return "dark";
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
  }, [initialTheme]);

  return <>{children}</>;
}
