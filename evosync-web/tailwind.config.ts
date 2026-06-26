import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
    },
    extend: {
      colors: {
        // === SEMANTIC TOKENS (use these in components) ===
        border: "hsl(var(--border) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        surface: {
          DEFAULT: "hsl(var(--surface) / <alpha-value>)",
          alt: "hsl(var(--surface-alt) / <alpha-value>)",
          raised: "hsl(var(--surface-raised) / <alpha-value>)",
          sunken: "hsl(var(--surface-sunken) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          hover: "hsl(var(--primary-hover) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          subtle: "hsl(var(--primary-subtle) / <alpha-value>)",
          ring: "hsl(var(--primary-ring) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          subtle: "hsl(var(--info-subtle) / <alpha-value>)",
          foreground: "hsl(var(--info-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          subtle: "hsl(var(--success-subtle) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          subtle: "hsl(var(--warning-subtle) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "hsl(var(--danger) / <alpha-value>)",
          subtle: "hsl(var(--danger-subtle) / <alpha-value>)",
          foreground: "hsl(var(--danger-foreground) / <alpha-value>)",
        },
        // === LEGACY ALIASES (mantém compatibilidade com código antigo) ===
        bg: "hsl(var(--background) / <alpha-value>)",
        panel: "hsl(var(--surface) / <alpha-value>)",
        "panel-alt": "hsl(var(--surface-alt) / <alpha-value>)",
        blue: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          hover: "hsl(var(--info) / <alpha-value>)",
        },
        // === BRAND TOKENS (landing pages de promoções por tenant) ===
        // Usado na página pública /promocoes/[slug]. Default neutro;
        // cada tenant pode sobrescrever via data-attribute no body.
        brand: {
          red: "hsl(var(--brand-red) / <alpha-value>)",
          "red-hover": "hsl(var(--brand-red-hover) / <alpha-value>)",
          yellow: "hsl(var(--brand-yellow) / <alpha-value>)",
          "yellow-soft": "hsl(var(--brand-yellow-soft) / <alpha-value>)",
          teal: "hsl(var(--brand-teal) / <alpha-value>)",
          "teal-soft": "hsl(var(--brand-teal-soft) / <alpha-value>)",
          cream: "hsl(var(--brand-cream) / <alpha-value>)",
          ink: "hsl(var(--brand-ink) / <alpha-value>)",
        },
        neutral: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          hover: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        warn: "hsl(var(--warning) / <alpha-value>)",
        "danger-soft": "hsl(var(--danger-foreground) / <alpha-value>)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.025em" }],
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.125rem" }],
        base: ["0.875rem", { lineHeight: "1.25rem" }],
        lg: ["1rem", { lineHeight: "1.5rem" }],
        xl: ["1.125rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        "3xl": ["1.75rem", { lineHeight: "2rem", letterSpacing: "-0.02em" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.025em" }],
        "5xl": ["3rem", { lineHeight: "1.1", letterSpacing: "-0.03em" }],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.02em",
        tight: "-0.01em",
      },
      boxShadow: {
        // Subtle elevation system
        "elev-0": "none",
        "elev-1": "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 1px 0 rgb(0 0 0 / 0.02)",
        "elev-2": "0 2px 4px 0 rgb(0 0 0 / 0.04), 0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 1px 0 rgb(0 0 0 / 0.02)",
        "elev-3": "0 8px 16px -4px rgb(0 0 0 / 0.08), 0 4px 6px -2px rgb(0 0 0 / 0.04), 0 2px 4px -1px rgb(0 0 0 / 0.02)",
        "elev-4": "0 16px 32px -8px rgb(0 0 0 / 0.12), 0 8px 16px -4px rgb(0 0 0 / 0.06), 0 4px 8px -2px rgb(0 0 0 / 0.03)",
        "elev-5": "0 24px 48px -12px rgb(0 0 0 / 0.18), 0 12px 24px -6px rgb(0 0 0 / 0.08), 0 6px 12px -3px rgb(0 0 0 / 0.04)",
        // Glow (primary-tinted)
        "glow-sm": "0 0 0 1px hsl(var(--primary) / 0.2), 0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "glow": "0 0 0 1px hsl(var(--primary) / 0.3), 0 4px 12px 0 hsl(var(--primary) / 0.15)",
        "glow-lg": "0 0 0 1px hsl(var(--primary) / 0.4), 0 8px 24px 0 hsl(var(--primary) / 0.2)",
        // Inner highlight for dark mode
        "inner-glow": "inset 0 1px 0 0 rgb(255 255 255 / 0.04)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-fast": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-from-top": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-from-bottom": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "shimmer-bg": {
          "0%, 100%": { backgroundColor: "hsl(var(--muted) / 0.5)" },
          "50%": { backgroundColor: "hsl(var(--muted) / 0.25)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "drawer-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 200ms ease-out",
        "fade-in-fast": "fade-in-fast 120ms ease-out",
        "slide-in-right": "slide-in-right 200ms ease-out",
        "slide-in-from-top": "slide-in-from-top 180ms ease-out",
        "slide-in-from-bottom": "slide-in-from-bottom 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "shimmer-bg": "shimmer-bg 1.6s ease-in-out infinite",
        "spin-slow": "spin-slow 3s linear infinite",
        "drawer-in": "drawer-in 240ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(to right, hsl(var(--border) / 0.4) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.4) 1px, transparent 1px)",
        "dot-pattern":
          "radial-gradient(circle, hsl(var(--border) / 0.5) 1px, transparent 1px)",
        "gradient-radial":
          "radial-gradient(ellipse 80% 50% at 50% -10%, hsl(var(--primary) / 0.15), transparent)",
        "gradient-primary":
          "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%)",
        "gradient-mesh":
          "radial-gradient(at 27% 37%, hsla(160, 60%, 30%, 0.3) 0px, transparent 50%), radial-gradient(at 97% 21%, hsla(220, 60%, 40%, 0.18) 0px, transparent 50%), radial-gradient(at 52% 99%, hsla(160, 60%, 25%, 0.25) 0px, transparent 50%)",
        // === BRAND LANDING GRADIENTS (Extra Atacarejo style) ===
        "brand-diagonal":
          "linear-gradient(135deg, hsl(var(--brand-red)) 0%, hsl(var(--brand-red-hover)) 50%, hsl(var(--brand-yellow)) 100%)",
        "brand-radial":
          "radial-gradient(ellipse 70% 60% at 30% 0%, hsl(var(--brand-yellow) / 0.35), transparent 60%), radial-gradient(ellipse 80% 50% at 100% 100%, hsl(var(--brand-red) / 0.18), transparent 60%)",
        "brand-stripes":
          "repeating-linear-gradient(135deg, hsl(var(--brand-yellow) / 0.18) 0 24px, transparent 24px 48px)",
      },
      backgroundSize: {
        "grid-32": "32px 32px",
        "grid-24": "24px 24px",
        "dot-24": "24px 24px",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
