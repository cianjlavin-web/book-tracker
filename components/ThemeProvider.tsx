"use client";

import { useEffect } from "react";
import { getTheme, applyTheme } from "@/lib/themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const themeId = localStorage.getItem("app_theme") ?? "rose";
    applyTheme(getTheme(themeId));
  }, []);

  return <>{children}</>;
}
