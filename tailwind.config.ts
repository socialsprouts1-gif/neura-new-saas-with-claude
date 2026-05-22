import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#00FF87",
          "green-dim": "#00CC6A",
          blue: "#00D4FF",
          "blue-dim": "#00A8CC",
          purple: "#7B2FFF",
          "purple-dim": "#5A1FCC",
        },
        dark: {
          950: "#050508",
          900: "#0A0A0F",
          850: "#0F0F18",
          800: "#141420",
          750: "#1A1A2E",
          700: "#1E1E35",
          600: "#252545",
          500: "#2E2E55",
        },
        glass: {
          white: "rgba(255,255,255,0.05)",
          "white-md": "rgba(255,255,255,0.08)",
          "white-lg": "rgba(255,255,255,0.12)",
          green: "rgba(0,255,135,0.08)",
          blue: "rgba(0,212,255,0.08)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Cal Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "hero-glow": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,255,135,0.15), transparent)",
        "card-glow": "radial-gradient(ellipse at top, rgba(0,255,135,0.08), transparent 60%)",
        "blue-glow": "radial-gradient(ellipse at top, rgba(0,212,255,0.08), transparent 60%)",
        "mesh-green": "radial-gradient(at 27% 37%, rgba(0,255,135,0.12) 0px, transparent 50%), radial-gradient(at 97% 21%, rgba(0,212,255,0.08) 0px, transparent 50%), radial-gradient(at 52% 99%, rgba(123,47,255,0.08) 0px, transparent 50%)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-up": "fadeUp 0.6s ease-out forwards",
        "slide-in-right": "slideInRight 0.5s ease-out forwards",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2.5s linear infinite",
        "border-spin": "borderSpin 3s linear infinite",
        "scan-line": "scanLine 3s linear infinite",
        "counter": "counter 2s ease-out forwards",
        "particle-float": "particleFloat 8s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,255,135,0.3), 0 0 40px rgba(0,255,135,0.1)" },
          "50%": { boxShadow: "0 0 40px rgba(0,255,135,0.5), 0 0 80px rgba(0,255,135,0.2)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        borderSpin: {
          "0%": { "--angle": "0deg" } as any,
          "100%": { "--angle": "360deg" } as any,
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(400%)" },
        },
        particleFloat: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.6" },
          "25%": { transform: "translate(10px, -20px) scale(1.1)", opacity: "1" },
          "75%": { transform: "translate(-10px, 10px) scale(0.9)", opacity: "0.4" },
        },
      },
      boxShadow: {
        "green-glow": "0 0 20px rgba(0,255,135,0.4), 0 0 60px rgba(0,255,135,0.15)",
        "green-glow-lg": "0 0 40px rgba(0,255,135,0.5), 0 0 100px rgba(0,255,135,0.2)",
        "blue-glow": "0 0 20px rgba(0,212,255,0.4), 0 0 60px rgba(0,212,255,0.15)",
        "glass": "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        "glass-lg": "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
        "card": "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
