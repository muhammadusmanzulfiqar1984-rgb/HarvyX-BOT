/**
 * Living Particle Agent System — public API.
 * Bot Factory registers additional agents via registerAgent().
 */

import { registerDefaultAgents } from './agents/defaults';
import {
  getAgent,
  hasAgent,
  listAgents,
  registerAgent,
  requireAgent,
  resolveAgentId,
} from './registry';

// Ensure defaults exist on first import (client modules).
registerDefaultAgents();

export { LivingParticleEngine } from './engine';
export { detectDeviceProfile } from './device';
export type { DeviceProfile } from './device';
export { registerDefaultAgents } from './agents/defaults';
export {
  getAgent,
  hasAgent,
  listAgents,
  registerAgent,
  requireAgent,
  resolveAgentId,
};
export type {
  AgentDefinition,
  AgentVisualState,
  BehaviorProfile,
  CreatureAnimationId,
  EngineOptions,
  FormationProfile,
  GeometrySource,
  MotionProfile,
  Particle,
  ParticleMetal,
  ParticleZone,
  QualityLevel,
} from './types';
