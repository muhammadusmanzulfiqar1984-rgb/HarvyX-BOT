/**
 * Living Particle Agent — shared types for the registry-driven engine.
 * Bot Factory will register additional agents without rewriting the engine.
 */

export type AgentVisualState =
  | 'idle'
  | 'forming'
  | 'formed'
  | 'thinking'
  | 'listening'
  | 'speaking'
  | 'roar'
  | 'transition'
  | 'error';

/** Gold = operator / hero. Silver = HARVYX agents. */
export type ParticleMetal = 'gold' | 'silver';

export type QualityLevel = 'high' | 'medium' | 'low';

/** Anatomical / structural zone for creature-specific forces. */
export type ParticleZone =
  | 'core'
  | 'face'
  | 'eye'
  | 'muzzle'
  | 'mane'
  | 'wing'
  | 'leg'
  | 'body'
  | 'tail'
  | 'head';

export type GeometrySource =
  | { type: 'image'; url: string; floodFillBg?: boolean }
  | { type: 'procedural'; kind: ProceduralCreatureKind };

export type ProceduralCreatureKind =
  | 'horse'
  | 'owl'
  | 'falcon'
  | 'hummingbird';

export type MotionProfile = {
  /** Base circulation / flow speed. */
  flow: number;
  /** Local orbital amplitude. */
  orbit: number;
  /** Volumetric breathing scale. */
  breathing: number;
  /** Organized micro-turbulence (not random chaos). */
  turbulence: number;
  /** Depth oscillation amplitude. */
  depthMovement: number;
  /** Spring attract strength once formed. */
  spring: number;
  /** Velocity damping once formed. */
  damp: number;
  /** Extra freedom for mane / wing / other loose zones. */
  looseZoneMul: number;
  /** Face / head stability (higher = tighter). */
  faceStability: number;
};

export type FormationProfile = {
  /** Formation duration range ms. */
  durationMs: [number, number];
  /** Pause after form before entrance reaction (lion roar). */
  postFormPauseMs: [number, number];
};

export type EntranceBehavior = {
  /** One-time entrance roar (Manager lion only). */
  roarOnce?: boolean;
  roarDurationMs?: [number, number];
};

export type BehaviorProfile = {
  /** Creature-specific continuous deformation id. */
  animation: CreatureAnimationId;
  /** Gallop / wing / hover cycle speed (Hz-ish). */
  cycleSpeed: number;
  /** Amplitude of creature deformation. */
  deformAmp: number;
  /** Lateral hover / flight drift. */
  driftAmp: number;
};

export type CreatureAnimationId =
  | 'lion-breath'
  | 'horse-gallop'
  | 'owl-observe'
  | 'falcon-flight'
  | 'hummingbird-hover';

export type AgentDefinition = {
  id: string;
  name: string;
  /** Symbolic creature label (for docs / Bot Factory). */
  symbol: string;
  /** Slug aliases that map to this agent (e.g. mian → manager). */
  aliases?: string[];
  geometry: GeometrySource;
  particleCount?: { min?: number; max?: number; preferred?: number };
  metal: ParticleMetal;
  motion: MotionProfile;
  formation: FormationProfile;
  entrance: EntranceBehavior;
  behavior: BehaviorProfile;
  /** Optional zone classifier override key. */
  zoneModel: 'lion' | 'horse' | 'owl' | 'falcon' | 'hummingbird';
};

export type Particle = {
  /** Rest target (geometry sample). */
  bx: number;
  by: number;
  bz: number;
  /** Live position. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  baseSize: number;
  r: number;
  g: number;
  b: number;
  a: number;
  seed: number;
  phase: number;
  rim: number;
  bright: number;
  zone: ParticleZone;
  /** Local movement weight (mane/wing higher). */
  localWeight: number;
  /** Creature-specific animation weight. */
  animWeight: number;
};

export type EngineOptions = {
  agent: AgentDefinition;
  quality?: QualityLevel;
  maxParticles?: number;
  /** Hero / preview: enable entrance roar if agent.entrance.roarOnce. */
  entranceRoar?: boolean;
  onReady?: (count: number) => void;
};
