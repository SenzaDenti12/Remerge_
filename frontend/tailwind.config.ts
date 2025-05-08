import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class", "[data-mode=\"dark\"]"], // Keep class strategy if needed, but default to dark
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))", // Main background
        foreground: "hsl(var(--foreground))", // Main text
        primary: {
          DEFAULT: "hsl(var(--primary))", // Accent Blue/Purple
          foreground: "hsl(var(--primary-foreground))", // Text on primary
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))", // Slightly lighter dark shade
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))", // Lighter gray/purple for subtle text
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))", // Used for hover, focus rings (maybe purple?)
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))", // Card background (darker than secondary?)
          foreground: "hsl(var(--card-foreground))",
        },
        // Add custom glow colors if needed
        glow: {
            primary: "hsl(var(--primary-glow))",
            secondary: "hsl(var(--secondary-glow))",
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
       boxShadow: {
        // Add glow effect using box-shadow
        'glow-primary': '0 0 15px 5px hsl(var(--primary-glow))',
        'glow-secondary': '0 0 15px 5px hsl(var(--secondary-glow))',
        'glow-sm-primary': '0 0 8px 2px hsl(var(--primary-glow))',
        'glow-sm-secondary': '0 0 8px 2px hsl(var(--secondary-glow))',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config 