/**
 * Sample particle rest targets from image or procedural luminance maps.
 * Photographs / drawings are NEVER rendered — only used as geometry density.
 */

import type {
  AgentDefinition,
  Particle,
  ParticleMetal,
  ParticleZone,
} from '../types';
import { renderProceduralCreature } from './procedural';

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function photoToMetal(
  r: number,
  g: number,
  b: number,
  metal: ParticleMetal,
): [number, number, number, number, number] {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const warm = (r * 0.55 + g * 0.35 + b * 0.1) / 255;
  const t = Math.min(1, Math.max(0, lum * 0.68 + warm * 0.32));

  const c0 = metal === 'gold' ? [0.42, 0.26, 0.09] : [0.22, 0.24, 0.28];
  const c1 = metal === 'gold' ? [0.92, 0.76, 0.42] : [0.72, 0.76, 0.82];
  const c2 = metal === 'gold' ? [1.0, 0.97, 0.88] : [0.96, 0.97, 0.99];

  let rr: number;
  let gg: number;
  let bb: number;
  if (t < 0.55) {
    const u = t / 0.55;
    rr = c0[0] + (c1[0] - c0[0]) * u;
    gg = c0[1] + (c1[1] - c0[1]) * u;
    bb = c0[2] + (c1[2] - c0[2]) * u;
  } else {
    const u = (t - 0.55) / 0.45;
    rr = c1[0] + (c2[0] - c1[0]) * u;
    gg = c1[1] + (c2[1] - c1[1]) * u;
    bb = c1[2] + (c2[2] - c1[2]) * u;
  }

  const a = Math.min(0.92, 0.22 + lum * 0.55 + hash01(lum * 100 + warm * 40) * 0.12);
  return [rr, gg, bb, a, lum];
}

function classifyZone(
  model: AgentDefinition['zoneModel'],
  nx: number,
  ny: number,
  rr: number,
  lum: number,
): ParticleZone {
  switch (model) {
    case 'lion':
      if (ny > 0.02 && ny < 0.38 && Math.abs(nx) > 0.08 && Math.abs(nx) < 0.42 && lum < 0.52)
        return 'eye';
      if (ny < 0.05 && ny > -0.48 && Math.abs(nx) < 0.28 && lum < 0.55) return 'muzzle';
      if (rr > 0.48) return 'mane';
      if (ny > 0.2 && Math.abs(nx) < 0.4) return 'face';
      return 'core';
    case 'horse':
      if (nx > 0.25 && ny > 0.15) return 'head';
      if (nx > 0.1 && ny > -0.05) return 'mane';
      // Legs only in lower limb columns — not the whole belly (prevents gallop tear)
      if (ny < -0.32 && (nx > 0.08 || nx < -0.05)) return 'leg';
      if (nx < -0.35) return 'tail';
      return 'body';
    case 'owl':
      if (Math.abs(nx) < 0.22 && ny > 0.05 && ny < 0.45 && lum < 0.45) return 'eye';
      if (Math.abs(nx) > 0.35) return 'wing';
      if (ny > 0.15) return 'head';
      return 'body';
    case 'falcon':
      if (Math.abs(nx) > 0.28) return 'wing';
      if (ny > 0.25) return 'head';
      if (ny < -0.25) return 'tail';
      return 'body';
    case 'hummingbird':
      if (Math.abs(nx) > 0.15 && ny > -0.05 && ny < 0.35) return 'wing';
      if (nx > 0.25) return 'head';
      if (nx < -0.25) return 'tail';
      return 'body';
    default:
      return 'core';
  }
}

function zoneWeights(zone: ParticleZone): { boost: number; local: number; anim: number } {
  switch (zone) {
    case 'eye':
      return { boost: 2.2, local: 0.35, anim: 0.4 };
    case 'muzzle':
      return { boost: 1.7, local: 0.55, anim: 0.7 };
    case 'mane':
      return { boost: 0.95, local: 1.6, anim: 1.4 };
    case 'wing':
      return { boost: 1.1, local: 1.8, anim: 2.0 };
    case 'leg':
      return { boost: 1.15, local: 1.5, anim: 2.2 };
    case 'tail':
      return { boost: 0.9, local: 1.4, anim: 1.3 };
    case 'head':
      return { boost: 1.4, local: 0.5, anim: 0.8 };
    case 'face':
      return { boost: 1.35, local: 0.45, anim: 0.5 };
    case 'body':
      return { boost: 1.15, local: 0.7, anim: 1.0 };
    default:
      return { boost: 1.2, local: 0.8, anim: 0.9 };
  }
}

type Cand = {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  a: number;
  w: number;
  rim: number;
  zone: ParticleZone;
  bright: number;
  local: number;
  anim: number;
};

async function loadImageData(url: string, sampleRes: number): Promise<{
  data: Uint8ClampedArray;
  SAMPLE: number;
  bg: Uint8Array;
}> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.decoding = 'async';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load ${url}`));
    el.src = url;
  });

  const SAMPLE = sampleRes;
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');

  const scale = Math.max(SAMPLE / img.width, SAMPLE / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.clearRect(0, 0, SAMPLE, SAMPLE);
  ctx.drawImage(img, (SAMPLE - dw) / 2, (SAMPLE - dh) / 2, dw, dh);
  const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);

  const bg = new Uint8Array(SAMPLE * SAMPLE);
  const lumAt = (x: number, y: number) => {
    const i = (y * SAMPLE + x) * 4;
    return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  };
  const BG_LUM = 0.09;
  const stack: number[] = [];
  const pushIfBg = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= SAMPLE || y >= SAMPLE) return;
    const idx = y * SAMPLE + x;
    if (bg[idx]) return;
    if (lumAt(x, y) > BG_LUM) return;
    bg[idx] = 1;
    stack.push(idx);
  };
  pushIfBg(0, 0);
  pushIfBg(SAMPLE - 1, 0);
  pushIfBg(0, SAMPLE - 1);
  pushIfBg(SAMPLE - 1, SAMPLE - 1);
  pushIfBg((SAMPLE / 2) | 0, 0);
  pushIfBg((SAMPLE / 2) | 0, SAMPLE - 1);
  pushIfBg(0, (SAMPLE / 2) | 0);
  pushIfBg(SAMPLE - 1, (SAMPLE / 2) | 0);
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % SAMPLE;
    const y = (idx / SAMPLE) | 0;
    pushIfBg(x + 1, y);
    pushIfBg(x - 1, y);
    pushIfBg(x, y + 1);
    pushIfBg(x, y - 1);
  }

  return { data, SAMPLE, bg };
}

function candidatesFromRaster(
  data: Uint8ClampedArray,
  SAMPLE: number,
  bg: Uint8Array | null,
  metal: ParticleMetal,
  zoneModel: AgentDefinition['zoneModel'],
): Cand[] {
  const cands: Cand[] = [];
  const cx = (SAMPLE - 1) / 2;
  const cy = (SAMPLE - 1) / 2;

  for (let y = 0; y < SAMPLE; y++) {
    for (let x = 0; x < SAMPLE; x++) {
      const idx = y * SAMPLE + x;
      if (bg && bg[idx]) continue;

      const i = idx * 4;
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      const pa = data[i + 3];
      if (pa < 12) continue;

      const lum = (0.299 * pr + 0.587 * pg + 0.114 * pb) / 255;
      if (lum < 0.04) continue;

      const nx = (x - cx) / cx;
      const ny = -((y - cy) / cy);
      const rr = Math.hypot(nx, ny);

      const zone = classifyZone(zoneModel, nx, ny, rr, lum);
      const zw = zoneWeights(zone);
      const detail = Math.min(1, Math.abs(lum - 0.4) * 1.4 + lum * 0.5);
      const weight = (0.18 + lum * 0.9) * detail * zw.boost;

      const [gr, gg, gb, ga, blum] = photoToMetal(pr, pg, pb, metal);

      let border = 0;
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          const xx = x + ox;
          const yy = y + oy;
          if (xx < 0 || yy < 0 || xx >= SAMPLE || yy >= SAMPLE) {
            border++;
            continue;
          }
          if (bg) {
            if (bg[yy * SAMPLE + xx]) border++;
          } else {
            const j = (yy * SAMPLE + xx) * 4;
            const l =
              (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) / 255;
            if (l < 0.06) border++;
          }
        }
      }
      const edge = 1 - Math.min(1, border / 18);
      const aSoft = ga * (0.45 + edge * 0.55);

      let z = (blum - 0.45) * 0.28;
      if (zone === 'eye') z += 0.14;
      else if (zone === 'muzzle' || zone === 'head') z += 0.1;
      else if (zone === 'mane' || zone === 'wing') z -= 0.06 + rr * 0.08;
      else if (zone === 'leg') z -= 0.04;
      else z += (1 - rr) * 0.04;

      cands.push({
        x: nx * 0.92,
        y: ny * 0.92,
        z,
        r: gr,
        g: gg,
        b: gb,
        a: aSoft,
        w: weight * (0.5 + edge * 0.5),
        rim: Math.min(1, Math.max(0, (rr - 0.28) / 0.75)),
        zone,
        bright: blum,
        local: zw.local,
        anim: zw.anim,
      });
    }
  }

  return cands;
}

export async function sampleAgentParticles(
  agent: AgentDefinition,
  count: number,
  sampleRes = 256,
): Promise<Particle[]> {
  let data: Uint8ClampedArray;
  let SAMPLE: number;
  let bg: Uint8Array | null = null;

  if (agent.geometry.type === 'image') {
    const loaded = await loadImageData(agent.geometry.url, sampleRes);
    data = loaded.data;
    SAMPLE = loaded.SAMPLE;
    bg = agent.geometry.floodFillBg === false ? null : loaded.bg;
  } else {
    const imageData = renderProceduralCreature(agent.geometry.kind, sampleRes);
    data = imageData.data;
    SAMPLE = sampleRes;
    // Procedural already has black void — mark near-black as bg
    bg = new Uint8Array(SAMPLE * SAMPLE);
    for (let i = 0; i < SAMPLE * SAMPLE; i++) {
      const o = i * 4;
      const lum = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255;
      if (lum < 0.05) bg[i] = 1;
    }
  }

  const cands = candidatesFromRaster(data, SAMPLE, bg, agent.metal, agent.zoneModel);
  if (cands.length < 300) {
    throw new Error(`Particle sample too sparse for agent "${agent.id}"`);
  }

  let totalW = 0;
  for (const c of cands) totalW += c.w;

  const particles: Particle[] = [];
  for (let n = 0; n < count; n++) {
    let r = hash01(n * 19.17 + 3.1) * totalW;
    let pick = cands[0];
    for (let i = 0; i < cands.length; i++) {
      r -= cands[i].w;
      if (r <= 0) {
        pick = cands[i];
        break;
      }
    }

    const jx = (hash01(n * 7.3) - 0.5) * (3.2 / SAMPLE);
    const jy = (hash01(n * 11.9) - 0.5) * (3.2 / SAMPLE);
    const jz = (hash01(n * 13.1) - 0.5) * 0.04;
    const seed = hash01(n * 91.7 + 0.33);
    const phase = seed * Math.PI * 2;

    const sizeVar =
      0.55 + seed * 1.35 + pick.a * 0.9 + (1 - pick.rim) * 0.35;
    const baseSize =
      pick.zone === 'eye'
        ? sizeVar * 1.15
        : pick.zone === 'wing' || pick.zone === 'mane'
          ? sizeVar * 0.95
          : sizeVar;

    const angle = hash01(n * 3.7) * Math.PI * 2;
    const rad = 0.55 + hash01(n * 5.1) * 1.9;
    const sx = Math.cos(angle) * rad * (0.7 + hash01(n * 2.9));
    const sy = Math.sin(angle) * rad * (0.7 + hash01(n * 4.1));
    const sz = (hash01(n * 2.2) - 0.5) * 1.1;

    particles.push({
      bx: pick.x + jx,
      by: pick.y + jy,
      bz: pick.z + jz,
      x: sx,
      y: sy,
      z: sz,
      vx: (hash01(n * 1.1) - 0.5) * 0.08,
      vy: (hash01(n * 1.7) - 0.5) * 0.08,
      vz: (hash01(n * 2.3) - 0.5) * 0.04,
      baseSize,
      r: pick.r,
      g: pick.g,
      b: pick.b,
      a: pick.a,
      seed,
      phase,
      rim: pick.rim,
      bright: pick.bright,
      zone: pick.zone,
      localWeight: pick.local,
      animWeight: pick.anim,
    });
  }

  return particles;
}
