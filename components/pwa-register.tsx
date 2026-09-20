'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Service-worker support is progressive; the archive still works normally.
    });
  }, []);

  return null;
}
