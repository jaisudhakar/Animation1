import { Cormorant_Garamond, Manrope } from 'next/font/google';
import config from '@/veloce.config';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata = {
  title: `${config.brand.name} — ${config.story.hero.title}`,
  description: config.brand.tagline,
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: config.colors.black,
};

export default function RootLayout({ children }) {
  const c = config.colors;
  const cssVars = {
    '--black': c.black,
    '--graphite': c.graphite,
    '--graphite-light': c.graphiteLight,
    '--text': c.text,
    '--text-dim': c.textDim,
    '--accent': c.accent,
  };
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} style={cssVars}>
      <body>{children}</body>
    </html>
  );
}
