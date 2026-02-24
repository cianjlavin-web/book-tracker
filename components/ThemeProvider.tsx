"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getTheme, applyTheme, applyColorMode, THEMES, type Theme, type ColorMode } from "@/lib/themes";

interface ThemeContextValue {
  theme: Theme;
  setThemeById: (id: string) => void;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[0],
  setThemeById: () => {},
  colorMode: "light",
  setColorMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const [colorMode, setColorModeState] = useState<ColorMode>("light");

  const setThemeById = useCallback((id: string) => {
    const t = getTheme(id);
    setTheme(t);
    applyTheme(t);
    localStorage.setItem("app_theme", id);
  }, []);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    applyColorMode(mode);
    localStorage.setItem("app_color_mode", mode);
  }, []);

  useEffect(() => {
    const themeId = localStorage.getItem("app_theme") ?? "rose";
    const t = getTheme(themeId);
    setTheme(t);
    applyTheme(t);

    const cm = (localStorage.getItem("app_color_mode") ?? "light") as ColorMode;
    setColorModeState(cm);
    applyColorMode(cm);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setThemeById, colorMode, setColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
