"use client";

import { useEffect } from "react";

/** Remove stale service workers that can cache old HTML/chunks after deploy. */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        void reg.unregister();
      });
    });
  }, []);

  return null;
}
