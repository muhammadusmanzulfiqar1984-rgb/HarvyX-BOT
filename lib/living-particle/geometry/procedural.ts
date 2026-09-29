/**
 * Procedural luminance maps for symbolic creatures.
 * Output is SAMPLE-ONLY geometry for particle targets — never rendered as images.
 */

import type { ProceduralCreatureKind } from '../types';

function softEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  alpha = 1,
  rot = 0,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function limb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  color: string,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

/** Draw a shaded creature silhouette into a square canvas. Returns ImageData. */
export function renderProceduralCreature(
  kind: ProceduralCreatureKind,
  size = 256,
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);

  switch (kind) {
    case 'horse':
      drawHorse(ctx, size);
      break;
    case 'owl':
      drawOwl(ctx, size);
      break;
    case 'falcon':
      drawFalcon(ctx, size);
      break;
    case 'hummingbird':
      drawHummingbird(ctx, size);
      break;
  }

  return ctx.getImageData(0, 0, size, size);
}

function drawHorse(ctx: CanvasRenderingContext2D, S: number) {
  const cx = S * 0.46;
  const cy = S * 0.52;
  // Body — soft volumes only (no stroke limbs → no line artifacts in particle sample)
  softEllipse(ctx, cx, cy, S * 0.28, S * 0.14, '#c8b070', 1);
  softEllipse(ctx, cx + S * 0.02, cy - S * 0.03, S * 0.22, S * 0.1, '#e8d090', 0.55);
  softEllipse(ctx, cx + S * 0.02, cy + S * 0.02, S * 0.2, S * 0.09, '#b89858', 0.35);
  // Neck + head
  softEllipse(ctx, cx + S * 0.22, cy - S * 0.16, S * 0.09, S * 0.15, '#c0a868', 1, -0.35);
  softEllipse(ctx, cx + S * 0.34, cy - S * 0.28, S * 0.11, S * 0.07, '#d4bc78', 1);
  softEllipse(ctx, cx + S * 0.44, cy - S * 0.26, S * 0.05, S * 0.035, '#b89858', 1);
  softEllipse(ctx, cx + S * 0.32, cy - S * 0.36, S * 0.026, S * 0.045, '#a88848', 0.95);
  softEllipse(ctx, cx + S * 0.36, cy - S * 0.3, S * 0.018, S * 0.014, '#1a1208', 1);
  softEllipse(ctx, cx + S * 0.36, cy - S * 0.3, S * 0.009, S * 0.007, '#f0e8c8', 0.95);
  // Mane — clustered volumes (not a thin horizontal band)
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    softEllipse(
      ctx,
      cx + S * (0.18 - t * 0.2),
      cy - S * (0.22 + t * 0.04 + (i % 2) * 0.02),
      S * (0.055 + t * 0.015),
      S * (0.07 + (i % 3) * 0.01),
      '#a88840',
      0.45 + t * 0.25,
      -0.2 + t * 0.15,
    );
  }
  // Tail — stacked soft blobs
  for (let i = 0; i < 7; i++) {
    softEllipse(
      ctx,
      cx - S * (0.3 + i * 0.03),
      cy + S * (0.02 + i * 0.025),
      S * 0.05,
      S * 0.06,
      '#9a7838',
      0.5,
      0.25,
    );
  }
  // Legs as tapered ellipse chains (volume, not stroke lines)
  const legs: [number, number, number, number][] = [
    [cx + S * 0.14, cy + S * 0.12, cx + S * 0.2, cy + S * 0.34],
    [cx + S * 0.02, cy + S * 0.12, cx - S * 0.02, cy + S * 0.36],
    [cx - S * 0.1, cy + S * 0.1, cx - S * 0.2, cy + S * 0.34],
    [cx - S * 0.02, cy + S * 0.1, cx + S * 0.06, cy + S * 0.35],
  ];
  for (const [x0, y0, x1, y1] of legs) {
    for (let s = 0; s <= 5; s++) {
      const u = s / 5;
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u;
      const r = S * (0.032 - u * 0.012);
      softEllipse(ctx, x, y, r, r * 1.15, '#b89858', 0.85 - u * 0.15);
    }
    softEllipse(ctx, x1, y1, S * 0.028, S * 0.016, '#807028', 0.9);
  }
}

function drawOwl(ctx: CanvasRenderingContext2D, S: number) {
  // Compact silhouette — leave void so particles form an owl, not a filled square
  const cx = S * 0.5;
  const cy = S * 0.48;
  // Body (smaller)
  softEllipse(ctx, cx, cy + S * 0.1, S * 0.16, S * 0.22, '#c4b078', 1);
  softEllipse(ctx, cx, cy + S * 0.08, S * 0.11, S * 0.16, '#e0d098', 0.5);
  // Head
  softEllipse(ctx, cx, cy - S * 0.12, S * 0.15, S * 0.14, '#d0bc80', 1);
  // Ear tufts — key owl cue
  softEllipse(ctx, cx - S * 0.12, cy - S * 0.28, S * 0.04, S * 0.08, '#b89858', 1, -0.35);
  softEllipse(ctx, cx + S * 0.12, cy - S * 0.28, S * 0.04, S * 0.08, '#b89858', 1, 0.35);
  // Wings tucked beside body (not filling frame)
  softEllipse(ctx, cx - S * 0.2, cy + S * 0.06, S * 0.08, S * 0.18, '#a88848', 0.9, -0.2);
  softEllipse(ctx, cx + S * 0.2, cy + S * 0.06, S * 0.08, S * 0.18, '#a88848', 0.9, 0.2);
  // Facial disc + large eyes
  softEllipse(ctx, cx, cy - S * 0.12, S * 0.13, S * 0.11, '#e8d8a0', 0.4);
  softEllipse(ctx, cx - S * 0.06, cy - S * 0.14, S * 0.055, S * 0.055, '#14120c', 1);
  softEllipse(ctx, cx + S * 0.06, cy - S * 0.14, S * 0.055, S * 0.055, '#14120c', 1);
  softEllipse(ctx, cx - S * 0.06, cy - S * 0.14, S * 0.028, S * 0.028, '#f5ecd0', 1);
  softEllipse(ctx, cx + S * 0.06, cy - S * 0.14, S * 0.028, S * 0.028, '#f5ecd0', 1);
  softEllipse(ctx, cx - S * 0.06, cy - S * 0.14, S * 0.012, S * 0.012, '#080604', 1);
  softEllipse(ctx, cx + S * 0.06, cy - S * 0.14, S * 0.012, S * 0.012, '#080604', 1);
  softEllipse(ctx, cx, cy - S * 0.05, S * 0.028, S * 0.032, '#8a6830', 1);
  softEllipse(ctx, cx - S * 0.05, cy + S * 0.3, S * 0.032, S * 0.02, '#7a5828', 0.9);
  softEllipse(ctx, cx + S * 0.05, cy + S * 0.3, S * 0.032, S * 0.02, '#7a5828', 0.9);
}

function drawFalcon(ctx: CanvasRenderingContext2D, S: number) {
  const cx = S * 0.48;
  const cy = S * 0.48;
  softEllipse(ctx, cx, cy, S * 0.13, S * 0.22, '#c8b070', 1);
  softEllipse(ctx, cx + S * 0.02, cy - S * 0.02, S * 0.09, S * 0.15, '#e4d090', 0.45);
  softEllipse(ctx, cx + S * 0.02, cy - S * 0.24, S * 0.09, S * 0.075, '#d0bc80', 1);
  softEllipse(ctx, cx + S * 0.12, cy - S * 0.22, S * 0.055, S * 0.032, '#a88840', 1);
  softEllipse(ctx, cx + S * 0.04, cy - S * 0.25, S * 0.022, S * 0.018, '#1a1008', 1);
  softEllipse(ctx, cx + S * 0.04, cy - S * 0.25, S * 0.01, S * 0.008, '#f0e8c0', 0.95);
  // Broad flight wings
  softEllipse(ctx, cx - S * 0.32, cy - S * 0.04, S * 0.32, S * 0.09, '#b89858', 0.95, -0.15);
  softEllipse(ctx, cx + S * 0.32, cy - S * 0.04, S * 0.32, S * 0.09, '#b89858', 0.95, 0.15);
  softEllipse(ctx, cx - S * 0.42, cy + S * 0.04, S * 0.14, S * 0.055, '#908040', 0.75, -0.35);
  softEllipse(ctx, cx + S * 0.42, cy + S * 0.04, S * 0.14, S * 0.055, '#908040', 0.75, 0.35);
  softEllipse(ctx, cx - S * 0.22, cy - S * 0.08, S * 0.2, S * 0.035, '#e8d8a0', 0.55);
  softEllipse(ctx, cx + S * 0.22, cy - S * 0.08, S * 0.2, S * 0.035, '#e8d8a0', 0.55);
  softEllipse(ctx, cx - S * 0.02, cy + S * 0.28, S * 0.11, S * 0.09, '#a88848', 0.88);
}

function drawHummingbird(ctx: CanvasRenderingContext2D, S: number) {
  const cx = S * 0.42;
  const cy = S * 0.5;
  // Body teardrop
  softEllipse(ctx, cx, cy, S * 0.11, S * 0.16, '#c8b070', 1, 0.35);
  softEllipse(ctx, cx + S * 0.02, cy - S * 0.02, S * 0.08, S * 0.11, '#e4d498', 0.5, 0.35);
  // Head
  softEllipse(ctx, cx + S * 0.12, cy - S * 0.14, S * 0.08, S * 0.07, '#d4bc80', 1);
  // Long thin beak — critical recognition cue
  limb(ctx, cx + S * 0.18, cy - S * 0.14, cx + S * 0.42, cy - S * 0.16, S * 0.02, '#a88840');
  softEllipse(ctx, cx + S * 0.42, cy - S * 0.16, S * 0.012, S * 0.01, '#8a6830', 1);
  softEllipse(ctx, cx + S * 0.14, cy - S * 0.15, S * 0.016, S * 0.013, '#1a1008', 1);
  softEllipse(ctx, cx + S * 0.14, cy - S * 0.15, S * 0.007, S * 0.006, '#f5ecd0', 1);
  // Wing blur discs (hover vibration silhouette)
  softEllipse(ctx, cx - S * 0.02, cy - S * 0.1, S * 0.26, S * 0.07, '#b89858', 0.7, -0.4);
  softEllipse(ctx, cx - S * 0.04, cy + S * 0.0, S * 0.24, S * 0.06, '#a88848', 0.5, 0.35);
  softEllipse(ctx, cx - S * 0.0, cy - S * 0.18, S * 0.2, S * 0.05, '#d0bc78', 0.4, -0.7);
  // Tail fork
  softEllipse(ctx, cx - S * 0.16, cy + S * 0.14, S * 0.05, S * 0.09, '#9a7838', 0.85, 0.5);
  softEllipse(ctx, cx - S * 0.1, cy + S * 0.16, S * 0.045, S * 0.08, '#9a7838', 0.8, -0.35);
}
