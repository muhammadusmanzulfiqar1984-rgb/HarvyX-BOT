'use client';

import { ControlAppShell } from '@/components/ControlAppShell';

export default function ControlLayout({ children }: { children: React.ReactNode }) {
  return <ControlAppShell>{children}</ControlAppShell>;
}
