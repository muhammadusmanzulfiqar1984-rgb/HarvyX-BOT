/**
 * Creature-specific target-field deformation (particle-level, not skeletal).
 */

import type { BehaviorProfile, Particle, ParticleZone } from '../types';

export type DeformResult = { x: number; y: number; z: number };

function is(zone: ParticleZone, ...set: ParticleZone[]): boolean {
  return set.includes(zone);
}

/** Deform rest target into living pose for this frame. */
export function deformTarget(
  p: Particle,
  t: number,
  behavior: BehaviorProfile,
): DeformResult {
  let x = p.bx;
  let y = p.by;
  let z = p.bz;
  const amp = behavior.deformAmp;
  const speed = behavior.cycleSpeed;
  const w = p.animWeight;
  const phase = p.phase;

  switch (behavior.animation) {
    case 'lion-breath': {
      const breath = Math.sin(t * 1.4 + phase * 0.3) * amp * 0.022 * (0.5 + p.rim);
      const mane =
        is(p.zone, 'mane')
          ? Math.sin(t * 2.1 + phase * 2) * amp * 0.035 * w
          : 0;
      const rr = Math.hypot(p.bx, p.by) + 1e-5;
      x += (p.bx / rr) * (breath + mane);
      y += (p.by / rr) * breath * 0.85;
      z += Math.sin(t * 1.1 + phase) * amp * 0.012;
      break;
    }
    case 'horse-gallop': {
      const gait = t * speed * Math.PI * 2;
      const stride = Math.sin(gait + phase * 0.12);
      const stride2 = Math.sin(gait * 2 + phase);
      // Gentle forward lean + body bob (kept small to avoid silhouette collapse)
      x += 0.01 * amp * Math.sin(gait * 0.5) + behavior.driftAmp * 0.008 * Math.sin(t * 0.35);
      y += stride * amp * 0.014;
      z += stride2 * amp * 0.006;
      if (is(p.zone, 'leg')) {
        const legPhase = p.bx > 0 ? 0 : Math.PI;
        const kick = Math.sin(gait + legPhase + (p.by < -0.2 ? 0.35 : 0));
        x += kick * amp * 0.035 * w;
        y += Math.cos(gait + legPhase) * amp * 0.04 * w;
      }
      if (is(p.zone, 'mane', 'tail')) {
        x -= (0.5 + 0.5 * Math.sin(gait + phase)) * amp * 0.03 * w;
        y += Math.sin(gait * 1.5 + phase) * amp * 0.015 * w;
      }
      if (is(p.zone, 'head')) {
        y += Math.sin(gait * 0.5) * amp * 0.01;
        x += Math.sin(gait * 0.25) * amp * 0.006;
      }
      break;
    }
    case 'owl-observe': {
      const hover = Math.sin(t * 1.2 + phase * 0.2) * amp * 0.025;
      y += hover;
      z += Math.sin(t * 0.9 + phase) * amp * 0.015;
      if (is(p.zone, 'wing')) {
        const flap = Math.sin(t * speed + (p.bx > 0 ? 0 : 0.3));
        y += flap * amp * 0.04 * w;
        x += Math.sign(p.bx || 1) * flap * amp * 0.02 * w;
      }
      if (is(p.zone, 'head', 'eye')) {
        const track = Math.sin(t * 0.35 + 0.2) * amp * 0.03;
        const nod = Math.sin(t * 0.55) * amp * 0.018;
        x += track;
        y += nod * 0.6;
      }
      if (is(p.zone, 'eye')) {
        // subtle density reorganize via radial pulse
        const pulse = Math.sin(t * 2.4 + phase) * amp * 0.012;
        x += (p.bx > 0 ? 1 : -1) * pulse;
        z += pulse * 0.5;
      }
      break;
    }
    case 'falcon-flight': {
      const wing = Math.sin(t * speed * Math.PI * 2);
      const glide = 0.5 + 0.5 * Math.sin(t * 0.45);
      y += Math.sin(t * 1.1) * amp * 0.02 * (0.4 + glide * 0.6);
      x += behavior.driftAmp * 0.015 * Math.sin(t * 0.55);
      z += Math.sin(t * 0.8 + phase) * amp * 0.025;
      if (is(p.zone, 'wing')) {
        const edge = p.rim;
        y += wing * amp * (0.05 + edge * 0.04) * w * (1 - glide * 0.45);
        x += Math.sign(p.bx || 1) * wing * amp * 0.03 * w;
        // leading edge faster
        if (p.by > 0) {
          x += wing * amp * 0.02 * w;
          z += wing * amp * 0.015 * w;
        }
      }
      if (is(p.zone, 'tail')) {
        y += wing * amp * 0.02 * w * 0.6;
      }
      if (is(p.zone, 'head', 'body')) {
        x += 0.01 * amp * Math.sin(t * 0.7);
      }
      break;
    }
    case 'hummingbird-hover': {
      const wing = Math.sin(t * speed * Math.PI * 2 + phase * 0.5);
      const hover = Math.sin(t * 3.2) * amp * 0.018;
      const lateral = Math.sin(t * 1.7) * behavior.driftAmp * 0.025;
      y += hover;
      x += lateral;
      z += Math.sin(t * 2.1 + phase) * amp * 0.012;
      if (is(p.zone, 'wing')) {
        // fine continuous vibration
        y += wing * amp * 0.09 * w;
        x += Math.sign(p.bx || -1) * wing * amp * 0.05 * w;
        z += Math.cos(t * speed * Math.PI * 2) * amp * 0.03 * w;
      }
      if (is(p.zone, 'tail')) {
        y += Math.sin(t * speed * 0.5 + phase) * amp * 0.02 * w;
      }
      if (is(p.zone, 'head', 'body')) {
        // body relatively stable
        x += lateral * 0.25;
        y += hover * 0.35;
      }
      break;
    }
    default:
      break;
  }

  return { x, y, z };
}
