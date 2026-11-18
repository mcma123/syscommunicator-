import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "wgjs-theme";
const THEME_COLORS: Record<Theme, string> = { light: "#f4024d", dark: "#09132c" };
const THEME_EVENT = "wgjs-theme-change";

/**
 * Runs inline in <head> before first paint so a saved (or system) dark preference never
 * flashes the light theme. Keep it dependency-free and in sync with applyTheme().
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"${THEME_COLORS.dark}":"${THEME_COLORS.light}");}catch(e){}})();`;

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  // Follow the operating-system preference until the user picks a theme explicitly.
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onSystemChange = (event: MediaQueryListEvent) => {
    if (!readStoredTheme()) applyTheme(event.matches ? "dark" : "light");
  };
  media?.addEventListener?.("change", onSystemChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    media?.removeEventListener?.("change", onSystemChange);
  };
}

export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the theme still applies for this page view.
  }
  applyTheme(theme);
}

/** Switches theme, using a circular reveal from `origin` where the browser supports it. */
export function switchTheme(theme: Theme, origin?: { x: number; y: number }) {
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => { ready: Promise<void> };
  };
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduceMotion || !origin) {
    setTheme(theme);
    return;
  }
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );
  const transition = doc.startViewTransition(() => setTheme(theme));
  void transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: 420,
          easing: "cubic-bezier(.4,0,.2,1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {});
}

export function useTheme() {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "light");
  const toggleTheme = useCallback(
    (origin?: { x: number; y: number }) => switchTheme(theme === "dark" ? "light" : "dark", origin),
    [theme],
  );
  return { theme, setTheme, toggleTheme };
}
