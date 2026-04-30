"use client";

import { useEffect, useState } from "react";

export interface ThemeColors {
  dark: boolean;
  mobile: boolean;
  // chart axes / labels (always visible without hover)
  tickColor: string;
  labelColor: string;
  // recharts cursor highlight
  cursorFill: string;
  // tooltip (shown on hover)
  tooltipBg: string;
  tooltipBorder: string;
  tooltipTitle: string;
  tooltipMuted: string;
  tooltipAccent: string;
}

const DARK: Omit<ThemeColors, "dark" | "mobile"> = {
  tickColor:     "rgba(214,203,147,0.55)",
  labelColor:    "#D6CB93",
  cursorFill:    "rgba(214,203,147,0.07)",
  tooltipBg:     "#0f1448",
  tooltipBorder: "#1a2160",
  tooltipTitle:  "#fefdf8",
  tooltipMuted:  "rgba(214,203,147,0.6)",
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
