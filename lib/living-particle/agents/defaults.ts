import type { AgentDefinition } from '../types';
import { registerAgent } from '../registry';

export const managerLion: AgentDefinition = {
  id: 'manager',
  name: 'Manager',
  symbol: 'realistic-lion',
  aliases: ['mian', 'harvyx-bot', 'lion'],
  geometry: {
    type: 'image',
    url: '/brand/great-lion.png',
    floodFillBg: true,
  },
  particleCount: { preferred: 22000, min: 6000, max: 36000 },
  metal: 'gold',
  zoneModel: 'lion',
  motion: {
    flow: 1.15,
    orbit: 0.028,
    breathing: 0.02,
    turbulence: 0.012,
    depthMovement: 0.55,
    spring: 0.22,
    damp: 0.8,
    looseZoneMul: 1.75,
    faceStability: 1.1,
  },
  formation: {
    durationMs: [220, 320],
    postFormPauseMs: [300, 800],
  },
  entrance: {
    roarOnce: true,
    roarDurationMs: [700, 1200],
  },
  behavior: {
    animation: 'lion-breath',
    cycleSpeed: 1.0,
    deformAmp: 1.0,
    driftAmp: 0.2,
  },
};

export const opsHorse: AgentDefinition = {
  id: 'ops',
  name: 'OPS',
  symbol: 'realistic-horse',
  aliases: ['operations'],
  geometry: { type: 'procedural', kind: 'horse' },
  particleCount: { preferred: 18000, min: 5000, max: 28000 },
  metal: 'silver',
  zoneModel: 'horse',
  motion: {
    flow: 1.15,
    orbit: 0.022,
    breathing: 0.014,
    turbulence: 0.008,
    depthMovement: 0.4,
    spring: 0.28,
    damp: 0.84,
    looseZoneMul: 1.35,
    faceStability: 1.15,
  },
  formation: {
    durationMs: [280, 420],
    postFormPauseMs: [0, 0],
  },
  entrance: { roarOnce: false },
  behavior: {
    animation: 'horse-gallop',
    cycleSpeed: 0.85,
    deformAmp: 0.55,
    driftAmp: 0.18,
  },
};

export const analystOwl: AgentDefinition = {
  id: 'analyst',
  name: 'Analyst',
  symbol: 'realistic-owl',
  aliases: ['reasoning'],
  geometry: { type: 'procedural', kind: 'owl' },
  particleCount: { preferred: 16000, min: 5000, max: 26000 },
  metal: 'silver',
  zoneModel: 'owl',
  motion: {
    flow: 0.95,
    orbit: 0.024,
    breathing: 0.022,
    turbulence: 0.01,
    depthMovement: 0.5,
    spring: 0.2,
    damp: 0.82,
    looseZoneMul: 1.5,
    faceStability: 1.35,
  },
  formation: {
    durationMs: [260, 380],
    postFormPauseMs: [0, 0],
  },
  entrance: { roarOnce: false },
  behavior: {
    animation: 'owl-observe',
    cycleSpeed: 1.1,
    deformAmp: 0.95,
    driftAmp: 0.3,
  },
};

export const scrapeFalcon: AgentDefinition = {
  id: 'scrape',
  name: 'Scrape',
  symbol: 'realistic-falcon',
  aliases: ['hawk', 'research'],
  geometry: { type: 'procedural', kind: 'falcon' },
  particleCount: { preferred: 16000, min: 5000, max: 26000 },
  metal: 'silver',
  zoneModel: 'falcon',
  motion: {
    flow: 1.65,
    orbit: 0.03,
    breathing: 0.016,
    turbulence: 0.018,
    depthMovement: 0.75,
    spring: 0.23,
    damp: 0.79,
    looseZoneMul: 2.1,
    faceStability: 1.05,
  },
  formation: {
    durationMs: [240, 340],
    postFormPauseMs: [0, 0],
  },
  entrance: { roarOnce: false },
  behavior: {
    animation: 'falcon-flight',
    cycleSpeed: 1.55,
    deformAmp: 1.2,
    driftAmp: 0.55,
  },
};

export const socialHummingbird: AgentDefinition = {
  id: 'social',
  name: 'Social',
  symbol: 'realistic-hummingbird',
  aliases: ['comms'],
  geometry: { type: 'procedural', kind: 'hummingbird' },
  particleCount: { preferred: 14000, min: 4000, max: 22000 },
  metal: 'silver',
  zoneModel: 'hummingbird',
  motion: {
    flow: 2.2,
    orbit: 0.034,
    breathing: 0.02,
    turbulence: 0.02,
    depthMovement: 0.6,
    spring: 0.26,
    damp: 0.76,
    looseZoneMul: 2.4,
    faceStability: 1.2,
  },
  formation: {
    durationMs: [220, 320],
    postFormPauseMs: [0, 0],
  },
  entrance: { roarOnce: false },
  behavior: {
    animation: 'hummingbird-hover',
    cycleSpeed: 8.5,
    deformAmp: 1.25,
    driftAmp: 0.7,
  },
};

/** Register the five initial symbolic agents. Idempotent. */
export function registerDefaultAgents(): void {
  registerAgent(managerLion);
  registerAgent(opsHorse);
  registerAgent(analystOwl);
  registerAgent(scrapeFalcon);
  registerAgent(socialHummingbird);
}
