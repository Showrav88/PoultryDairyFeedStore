"use client";

import { I18nProvider } from "@/lib/i18n/context";
import { ThemeProvider } from "./theme-provider";
import { ServiceWorkerCleanup } from "./service-worker-cleanup";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ServiceWorkerCleanup />
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
