import typography from '@tailwindcss/typography';
import containerQueries from '@tailwindcss/container-queries';
import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: ['index.html', 'src/**/*.{js,ts,jsx,tsx,html,css}'],
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px'
            }
        },
        extend: {
            colors: {
                border: 'oklch(var(--border))',
                input: 'oklch(var(--input))',
                ring: 'oklch(var(--ring) / <alpha-value>)',
                background: 'oklch(var(--background))',
                foreground: 'oklch(var(--foreground))',
                primary: {
                    DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
                    foreground: 'oklch(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
                    foreground: 'oklch(var(--secondary-foreground))'
                },
                destructive: {
                    DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
                    foreground: 'oklch(var(--destructive-foreground))'
                },
                muted: {
                    DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
                    foreground: 'oklch(var(--muted-foreground) / <alpha-value>)'
                },
                accent: {
                    DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
                    foreground: 'oklch(var(--accent-foreground))'
                },
                popover: {
                    DEFAULT: 'oklch(var(--popover))',
                    foreground: 'oklch(var(--popover-foreground))'
                },
                card: {
                    DEFAULT: 'oklch(var(--card))',
                    foreground: 'oklch(var(--card-foreground))'
                },
                chart: {
                    1: 'oklch(var(--chart-1))',
                    2: 'oklch(var(--chart-2))',
                    3: 'oklch(var(--chart-3))',
                    4: 'oklch(var(--chart-4))',
                    5: 'oklch(var(--chart-5))'
                },
                sidebar: {
                    DEFAULT: 'oklch(var(--sidebar))',
                    foreground: 'oklch(var(--sidebar-foreground))',
                    primary: 'oklch(var(--sidebar-primary))',
                    'primary-foreground': 'oklch(var(--sidebar-primary-foreground))',
                    accent: 'oklch(var(--sidebar-accent))',
                    'accent-foreground': 'oklch(var(--sidebar-accent-foreground))',
                    border: 'oklch(var(--sidebar-border))',
                    ring: 'oklch(var(--sidebar-ring))'
                }
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            boxShadow: {
                xs: '0 1px 2px 0 rgba(0,0,0,0.05)'
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' }
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' }
                },
                'pulse-glow': {
                    '0%, 100%': { opacity: '0.7', filter: 'brightness(1)' },
                    '50%': { opacity: '1', filter: 'brightness(1.3)' }
                },
                'ripple-glow': {
                    '0%': { boxShadow: '0 0 0 0 oklch(var(--neon-purple) / 0.8)' },
                    '50%': { boxShadow: '0 0 30px 15px oklch(var(--neon-purple) / 0.4)' },
                    '100%': { boxShadow: '0 0 0 0 oklch(var(--neon-purple) / 0)' }
                },
                'neon-flicker': {
                    '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
                    '50%': { opacity: '0.95', filter: 'brightness(1.15)' }
                },
                'text-glow-shift': {
                    '0%': { 
                        textShadow: '0 0 10px rgba(34, 211, 238, 0.8), 0 0 20px rgba(34, 211, 238, 0.6), 0 0 30px rgba(34, 211, 238, 0.4)',
                        filter: 'brightness(1)'
                    },
                    '33%': { 
                        textShadow: '0 0 12px rgba(236, 72, 153, 0.8), 0 0 24px rgba(236, 72, 153, 0.6), 0 0 36px rgba(236, 72, 153, 0.4)',
                        filter: 'brightness(1.1)'
                    },
                    '66%': { 
                        textShadow: '0 0 11px rgba(168, 85, 247, 0.8), 0 0 22px rgba(168, 85, 247, 0.6), 0 0 33px rgba(168, 85, 247, 0.4)',
                        filter: 'brightness(1.05)'
                    },
                    '100%': { 
                        textShadow: '0 0 10px rgba(34, 211, 238, 0.8), 0 0 20px rgba(34, 211, 238, 0.6), 0 0 30px rgba(34, 211, 238, 0.4)',
                        filter: 'brightness(1)'
                    }
                },
                'text-glow-pulse': {
                    '0%, 100%': { 
                        textShadow: '0 0 8px currentColor, 0 0 16px currentColor, 0 0 24px currentColor',
                        filter: 'brightness(1)'
                    },
                    '50%': { 
                        textShadow: '0 0 12px currentColor, 0 0 24px currentColor, 0 0 36px currentColor',
                        filter: 'brightness(1.2)'
                    }
                },
                'text-shimmer': {
                    '0%': { textShadow: '0 0 10px rgba(34, 211, 238, 0.7), 0 0 20px rgba(34, 211, 238, 0.5)' },
                    '25%': { textShadow: '0 0 12px rgba(168, 85, 247, 0.7), 0 0 24px rgba(168, 85, 247, 0.5)' },
                    '50%': { textShadow: '0 0 11px rgba(236, 72, 153, 0.7), 0 0 22px rgba(236, 72, 153, 0.5)' },
                    '75%': { textShadow: '0 0 12px rgba(168, 85, 247, 0.7), 0 0 24px rgba(168, 85, 247, 0.5)' },
                    '100%': { textShadow: '0 0 10px rgba(34, 211, 238, 0.7), 0 0 20px rgba(34, 211, 238, 0.5)' }
                }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'pulse-glow': 'pulse-glow 1.5s ease-in-out infinite',
                'ripple-glow': 'ripple-glow 2.5s ease-in-out infinite',
                'neon-flicker': 'neon-flicker 2.5s ease-in-out infinite',
                'text-glow-shift': 'text-glow-shift 4s ease-in-out infinite',
                'text-glow-pulse': 'text-glow-pulse 2s ease-in-out infinite',
                'text-shimmer': 'text-shimmer 3.5s ease-in-out infinite'
            }
        }
    },
    plugins: [typography, containerQueries, animate]
};

