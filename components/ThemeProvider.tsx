"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getTheme, applyTheme, THEMES, type Theme } from "@/lib/themes";

interface ThemeContextValue {
  theme: Theme;
  setThemeById: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[0],
  setThemeById: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(THEMES[0]);

  const setThemeById = useCallback((id: string) => {
    const t = getTheme(id);
    setTheme(t);
    applyTheme(t);
    localStorage.setItem("app_theme", id);
  }, []);

  useEffect(() => {
    const themeId = localStorage.getItem("app_theme") ?? "rose";
    const t = getTheme(themeId);
    setTheme(t);
    applyTheme(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setThemeById }}>
      {children}
    </ThemeContext.Provider>
  );
}
