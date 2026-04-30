"use client";

import { useEffect, useState } from "react";

export interface ThemeColors {
  dark: boolean;
  mobile: boolean;
  tickColor: string;
  labelColor: string;
  cursorFill: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipTitle: string;
  tooltipMuted: string;
  tooltipAccent: string;
}

// Gray-950/900 dark mode — matches pre-brand dashboard palette
const DARK: Omit<ThemeColors, "dark" | "mobile"> = {
  tickColor:     "#6b7280", // gray-500
  labelColor:    "#9ca3af", // gray-400
  cursorFill:    "rgba(75,85,99,0.25)",
  tooltipBg:     "#111827", // gray-900
  tooltipBorder: "#374151", // gray-700
  tooltipTitle:  "#ffffff",
  tooltipMuted:  "#9ca3af", // gray-400
  tooltipAccent: "#eb0029",
};

const LIGHT: Omit<ThemeColors, "dark" | "mobile"> = {
  tickColor:     "rgba(35,30,32,0.45)",
  labelColor:    "#231e20",
  cursorFill:    "rgba(5,48,140,0.05)",
  tooltipBg:     "#ffffff",
  tooltipBorder: "rgba(214,203,147,0.5)",
  tooltipTitle:  "#231e20",
  tooltipMuted:  "rgba(35,30,32,0.5)",
  tooltipAccent: "#eb0029",
};

export function useThemeColors(): ThemeColors {
  const [dark, setDark] = useState(true);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const checkDark = () => setDark(el.classList.contains("dark"));
    const checkMobile = () => setMobile(window.innerWidth < 640);

    checkDark();
    checkMobile();

    const obs = new MutationObserver(checkDark);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", checkMobile);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return { dark, mobile, ...(dark ? DARK : LIGHT) };
}
