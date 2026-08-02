import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Channel form, not `var(--bg-N)`: it is the only way Tailwind can
        // build `bg-bg-2/60` and friends. See the --bg-*-rgb note in
        // globals.css — 116 such classes were silently painting nothing.
        bg: {
          0: "rgb(var(--bg-0-rgb) / <alpha-value>)",
          1: "rgb(var(--bg-1-rgb) / <alpha-value>)",
          2: "rgb(var(--bg-2-rgb) / <alpha-value>)",
          3: "rgb(var(--bg-3-rgb) / <alpha-value>)",
        },
        line: "var(--line)",
        "text-hi": "var(--text-hi)",
        "text-lo": "var(--text-lo)",
        ice: "var(--ice)",
        amber: "var(--amber)",
        violet: "var(--violet)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        card: "10px",
        input: "8px",
        chip: "999px",
        panel: "var(--radius-panel)",
      },
      fontFamily: {
        // Two-typeface system: Space Grotesk gives titles distinctness,
        // Inter carries everything else (body copy and data alike — the
        // former JetBrains Mono role folded into Inter to keep it to two).
        display: ["var(--font-space-grotesk)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        raise: "0 8px 24px rgba(0, 0, 0, 0.4)",
        e1: "var(--shadow-1)",
        e2: "var(--shadow-2)",
        e3: "var(--shadow-3)",
      },
      transitionDuration: {
        hover: "150ms",
        drawer: "250ms",
      },
      keyframes: {
        "infinite-slider-x": {
          from: { transform: "translate3d(0, 0, 0)" },
          to: { transform: "translate3d(-50%, 0, 0)" },
        },
        "infinite-slider-y": {
          from: { transform: "translate3d(0, 0, 0)" },
          to: { transform: "translate3d(0, -50%, 0)" },
        },
      },
      animation: {
        "spin-slow": "spin 16s linear infinite",
        "infinite-slider-x":
          "infinite-slider-x var(--infinite-slider-duration, 40s) linear infinite",
        "infinite-slider-x-reverse":
          "infinite-slider-x var(--infinite-slider-duration, 40s) linear infinite reverse",
        "infinite-slider-y":
          "infinite-slider-y var(--infinite-slider-duration, 40s) linear infinite",
        "infinite-slider-y-reverse":
          "infinite-slider-y var(--infinite-slider-duration, 40s) linear infinite reverse",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
