/**
 * Device capability heuristics for adaptive particle budgets.
 * Used by LivingParticleEngine + LivingParticleAgent — no React state.
 */

import type { QualityLevel } from './types';

export type DeviceProfile = {
  quality: QualityLevel;
  /** Soft cap applied on top of agent preferred counts. */
  particleCap: number;
  /** Target animation interval ms (16 ≈ 60fps, 33 ≈ 30fps). */
  frameIntervalMs: number;
  dprCap: number;
};

export function detectDeviceProfile(sizeHint = 168): DeviceProfile {
  if (typeof window === 'undefined') {
    return { quality: 'medium', particleCap: 12000, frameIntervalMs: 33, dprCap: 1.5 };
  }

  const w = window.innerWidth;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  const mobile = w < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  if (reduced || saveData) {
    return { quality: 'low', particleCap: sizeHint <= 48 ? 900 : 5000, frameIntervalMs: 50, dprCap: 1 };
  }
  if (mobile || cores <= 4 || mem <= 4 || w < 480) {
    return {
      quality: 'low',
      particleCap: sizeHint <= 48 ? 1200 : sizeHint <= 100 ? 6000 : 10000,
      frameIntervalMs: 33,
      dprCap: 1.25,
    };
  }
  if (cores < 8 || mem < 8 || w < 1100) {
    return {
      quality: 'medium',
      particleCap: sizeHint <= 48 ? 2000 : sizeHint <= 100 ? 10000 : 18000,
      frameIntervalMs: 22,
      dprCap: 1.75,
    };
  }
  return {
    quality: 'high',
    particleCap: sizeHint <= 48 ? 2800 : sizeHint <= 100 ? 14000 : 28000,
    frameIntervalMs: 16,
    dprCap: 2,
  };
}
