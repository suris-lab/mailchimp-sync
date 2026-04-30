"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("hebe-theme");
    const isDark = stored !== "light";
    setDark(isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("hebe-theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center gap-1.5 rounded-lg border border-hebe-champagne/30 px-3 py-2 text-xs
                 text-hebe-champagne hover:border-hebe-champagne/60 hover:text-hebe-gold transition-colors
                 dark:border-hebe-deep-3 dark:text-hebe-champagne dark:hover:border-hebe-champagne/50
                 bg-transparent"
    >
      {dark ? <Sun size={13} /> : <Moon size={13} />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}
