export interface Theme {
  id: string;
  name: string;
  accent: string;
  accentLight: string;
  accentPale: string;
  pageBg: string;
  gradientFrom: string;
  gradientTo: string;
}

export const THEMES: Theme[] = [
  {
    id: "rose",
    name: "Rose",
    accent: "#E8599A",
    accentLight: "#F4A7CB",
    accentPale: "#FAE0EE",
    pageBg: "#4D4465",
    gradientFrom: "#E8599A",
    gradientTo: "#E87A50",
  },
  {
    id: "ocean",
    name: "Ocean",
    accent: "#0EA5E9",
    accentLight: "#7DD3FC",
    accentPale: "#E0F2FE",
    pageBg: "#1B3A52",
    gradientFrom: "#0EA5E9",
    gradientTo: "#6366F1",
  },
  {
    id: "forest",
    name: "Forest",
    accent: "#22C55E",
    accentLight: "#86EFAC",
    accentPale: "#DCFCE7",
    pageBg: "#1A2E23",
    gradientFrom: "#22C55E",
    gradientTo: "#10B981",
  },
  {
    id: "sunset",
    name: "Sunset",
    accent: "#F97316",
    accentLight: "#FDBA74",
    accentPale: "#FFF7ED",
    pageBg: "#3B1F0A",
    gradientFrom: "#F97316",
    gradientTo: "#EF4444",
  },
  {
    id: "violet",
    name: "Violet",
    accent: "#A855F7",
    accentLight: "#D8B4FE",
    accentPale: "#F3E8FF",
    pageBg: "#2D1B4E",
    gradientFrom: "#A855F7",
    gradientTo: "#EC4899",
  },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(theme: Theme) {
  const r = document.documentElement;
  r.style.setProperty("--color-pink", theme.accent);
  r.style.setProperty("--color-pink-light", theme.accentLight);
  r.style.setProperty("--color-pink-pale", theme.accentPale);
  r.style.setProperty("--color-page-bg", theme.pageBg);
  r.style.setProperty("--color-gradient-a", theme.gradientFrom);
  r.style.setProperty("--color-gradient-b", theme.gradientTo);
}

// Serialized for inline <script> anti-FOUC (must stay in sync with THEMES above)
export const THEME_SCRIPT = `(function(){var t={rose:{a:'#E8599A',al:'#F4A7CB',ap:'#FAE0EE',bg:'#4D4465',gf:'#E8599A',gt:'#E87A50'},ocean:{a:'#0EA5E9',al:'#7DD3FC',ap:'#E0F2FE',bg:'#1B3A52',gf:'#0EA5E9',gt:'#6366F1'},forest:{a:'#22C55E',al:'#86EFAC',ap:'#DCFCE7',bg:'#1A2E23',gf:'#22C55E',gt:'#10B981'},sunset:{a:'#F97316',al:'#FDBA74',ap:'#FFF7ED',bg:'#3B1F0A',gf:'#F97316',gt:'#EF4444'},violet:{a:'#A855F7',al:'#D8B4FE',ap:'#F3E8FF',bg:'#2D1B4E',gf:'#A855F7',gt:'#EC4899'}};var id=localStorage.getItem('app_theme')||'rose';var th=t[id]||t.rose;var r=document.documentElement;r.style.setProperty('--color-pink',th.a);r.style.setProperty('--color-pink-light',th.al);r.style.setProperty('--color-pink-pale',th.ap);r.style.setProperty('--color-page-bg',th.bg);r.style.setProperty('--color-gradient-a',th.gf);r.style.setProperty('--color-gradient-b',th.gt);})();`;
