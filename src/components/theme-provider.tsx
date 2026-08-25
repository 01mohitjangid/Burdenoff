'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // The colours are CSS variables, so animating them on every theme change
      // makes the switch feel like a fade rather than a flash.
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
