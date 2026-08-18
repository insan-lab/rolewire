"use client";

import { Moon, Sun } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

const LS_KEY = "rw-theme";
const DEFAULT: Theme = "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with default to avoid SSR/hydration mismatch; read localStorage after mount.
  const [theme, setTheme] = useState<Theme>(DEFAULT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY) as Theme | null;
    const resolved: Theme = stored === "light" ? "light" : "dark";
    setTheme(resolved);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    if (theme === "light") {
      html.setAttribute("data-theme", "light");
    } else {
      html.removeAttribute("data-theme");
    }
    localStorage.setItem(LS_KEY, theme);
  }, [theme, mounted]);

  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Sun / moon toggle button — drop into any nav bar.
 * Renders as an empty placeholder until mounted so the icon never flickers
 * between server render and client hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? (theme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      className={
        className ??
        "rounded-md p-1.5 text-dim transition-colors hover:bg-[var(--ink-soft)] hover:text-paper"
      }
    >
      {/* Render nothing until mounted so server/client HTML matches */}
      {mounted ? (
        theme === "dark" ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )
      ) : (
        <span className="size-4 block" aria-hidden />
      )}
    </button>
  );
}
