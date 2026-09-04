"use client";

import { I18nProvider } from "@/lib/i18n/context";
import { ThemeProvider } from "./theme-provider";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
