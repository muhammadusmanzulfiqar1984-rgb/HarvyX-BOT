'use client';

import { useEffect } from 'react';

/** Registers /sw.js only when NEXT_PUBLIC_PWA_ENABLED=1 — no service worker ships today. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PWA_ENABLED !== '1') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
