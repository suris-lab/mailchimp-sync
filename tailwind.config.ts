import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hebe: {
          red:        "#eb0029",
          "red-dark": "#c40022",
          navy:       "#05308C",
          "navy-mid": "#0d3fa8",
          "deep":     "#0a0a3a",
          "deep-2":   "#0f1448",
          "deep-3":   "#1a2160",
          gold:       "#ffce00",
          champagne:  "#D6CB93",
          cream:      "#fefdf8",
          ink:        "#231e20",
        },
      },
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        sans:  ["Inter", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
