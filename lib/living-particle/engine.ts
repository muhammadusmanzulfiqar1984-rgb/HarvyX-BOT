/**
 * Living Particle Agent Engine — reusable WebGL POINTS field.
 * One engine, config-driven agents. Animation loop outside React.
 */

import type {
  AgentDefinition,
  AgentVisualState,
  EngineOptions,
  Particle,
  QualityLevel,
} from './types';
import { sampleAgentParticles } from './geometry/sample';
import { deformTarget } from './motion/deform';
import { detectDeviceProfile } from './device';

const VERT = [
  'precision mediump float;',
  'attribute vec3 a_pos;',
  'attribute vec4 a_col;',
  'attribute float a_size;',
  'uniform float u_pointScale;',
  'varying vec4 v_col;',
  'void main() {',
  '  v_col = a_col;',
  '  float persp = 1.0 / (1.0 - a_pos.z * 0.22);',
  '  gl_Position = vec4(a_pos.xy * persp, 0.0, 1.0);',
  '  float depth = 0.72 + a_pos.z * 0.55;',
  '  gl_PointSize = max(1.25, a_size * u_pointScale * depth);',
  '}',
].join('\n');

const FRAG = [
  'precision mediump float;',
  'varying vec4 v_col;',
  'void main() {',
  '  vec2 c = gl_PointCoord - vec2(0.5);',
  '  float d = length(c);',
  '  float core = 1.0 - smoothstep(0.0, 0.16, d);',
  '  float halo = 1.0 - smoothstep(0.1, 0.42, d);',
  '  float soft = core * 0.9 + halo * 0.45;',
  '  float alpha = v_col.a * soft;',
  '  if (alpha < 0.04) discard;',
  '  vec3 rgb = v_col.rgb * (0.55 + core * 0.7);',
  '  gl_FragColor = vec4(rgb * alpha, alpha);',
  '}',
].join('\n');

function compile(gl: WebGLRenderingContext, type: number, src: string, label: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error(`shader create failed (${label})`);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh) || 'unknown';
    gl.deleteShader(sh);
    throw new Error(`${label}: ${info}`);
  }
  return sh;
}

function link(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error('program create failed');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) || 'unknown';
    gl.deleteProgram(prog);
    throw new Error(`link: ${info}`);
  }
  return prog;
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function getWebGL(canvas: HTMLCanvasElement): WebGLRenderingContext {
  const attrs: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  };
  const existing =
    (canvas.getContext('webgl', attrs) as WebGLRenderingContext | null) ||
    (canvas.getContext('experimental-webgl', attrs) as WebGLRenderingContext | null);
  if (!existing) throw new Error('WebGL unavailable');
  return existing;
}

function pickParticleCount(agent: AgentDefinition, quality?: QualityLevel, cap?: number): number {
  const preferred = agent.particleCount?.preferred ?? 18000;
  const min = agent.particleCount?.min ?? 4000;
  const max = agent.particleCount?.max ?? 32000;
  const profile = detectDeviceProfile(168);
  const q = quality ?? profile.quality;

  let n: number;
  if (q === 'low') n = min;
  else if (q === 'medium') n = Math.round(min + (preferred - min) * 0.45);
  else n = preferred;

  const softCap = Math.min(profile.particleCap, max);
  if (cap != null) n = Math.min(n, cap);
  n = Math.min(n, softCap);
  return Math.max(Math.min(min, softCap), Math.min(max, n));
}

function randRange([a, b]: [number, number]): number {
  return a + Math.random() * Math.max(0, b - a);
}

export class LivingParticleEngine {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private bufPos: WebGLBuffer;
  private bufCol: WebGLBuffer;
  private bufSize: WebGLBuffer;
  private locPos: number;
  private locCol: number;
  private locSize: number;
  private uPointScale: WebGLUniformLocation | null;
  private particles: Particle[] = [];
  private posArr: Float32Array | null = null;
  private colArr: Float32Array | null = null;
  private sizeArr: Float32Array | null = null;
  private raf = 0;
  private running = false;
  private destroyed = false;
  private state: AgentVisualState = 'forming';
  private formStart = 0;
  private formDuration = 280;
  private forming = true;
  private roarStart = -1;
  private roarDuration = 900;
  private t0 = 0;
  private opts: EngineOptions;
  private agent: AgentDefinition;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private count = 0;
  private returnState: AgentVisualState = 'idle';
  private entranceRoarAt = -1;
  private entranceRoarDone = false;
  private paused = false;
  private visible = true;
  private pageVisible = true;
  private lastFrameAt = 0;
  private frameIntervalMs = 16;
  private dprCap = 2;

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    opts: EngineOptions,
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.opts = opts;
    this.agent = opts.agent;
    const profile = detectDeviceProfile(160);
    this.frameIntervalMs = profile.frameIntervalMs;
    this.dprCap = profile.dprCap;
    if (opts.quality === 'low') this.frameIntervalMs = Math.max(this.frameIntervalMs, 40);
    else if (opts.quality === 'medium') this.frameIntervalMs = Math.max(this.frameIntervalMs, 22);

    this.bufPos = gl.createBuffer()!;
    this.bufCol = gl.createBuffer()!;
    this.bufSize = gl.createBuffer()!;
    this.locPos = gl.getAttribLocation(program, 'a_pos');
    this.locCol = gl.getAttribLocation(program, 'a_col');
    this.locSize = gl.getAttribLocation(program, 'a_size');
    this.uPointScale = gl.getUniformLocation(program, 'u_pointScale');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  static create(canvas: HTMLCanvasElement, opts: EngineOptions): LivingParticleEngine {
    const gl = getWebGL(canvas);
    const vs = compile(gl, gl.VERTEX_SHADER, VERT, 'vert');
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG, 'frag');
    const program = link(gl, vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return new LivingParticleEngine(canvas, gl, program, opts);
  }

  get particleCount(): number {
    return this.count;
  }

  get agentId(): string {
    return this.agent.id;
  }

  async init(): Promise<void> {
    const count = pickParticleCount(this.agent, this.opts.quality, this.opts.maxParticles);
    this.count = count;
    const sampleRes = count <= 12000 ? 160 : count <= 28000 ? 220 : 256;
    const particles = await sampleAgentParticles(this.agent, count, sampleRes);
    if (this.destroyed) return;
    this.particles = particles;
    this.posArr = new Float32Array(count * 3);
    this.colArr = new Float32Array(count * 4);
    this.sizeArr = new Float32Array(count);

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPos);
    gl.bufferData(gl.ARRAY_BUFFER, this.posArr, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCol);
    gl.bufferData(gl.ARRAY_BUFFER, this.colArr, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSize);
    gl.bufferData(gl.ARRAY_BUFFER, this.sizeArr, gl.DYNAMIC_DRAW);

    this.formStart = performance.now();
    this.formDuration = randRange(this.agent.formation.durationMs);
    this.forming = true;
    this.state = 'forming';
    this.entranceRoarDone = false;

    const wantRoar =
      Boolean(this.opts.entranceRoar) && Boolean(this.agent.entrance.roarOnce);
    if (wantRoar) {
      const pause = randRange(this.agent.formation.postFormPauseMs);
      this.entranceRoarAt = this.formStart + this.formDuration + pause;
    } else {
      this.entranceRoarAt = -1;
      this.entranceRoarDone = true;
    }
    this.opts.onReady?.(count);
  }

  setState(state: AgentVisualState): void {
    if (state === 'roar') {
      this.triggerRoar();
      return;
    }
    if (this.state === 'roar') {
      this.returnState = state;
      return;
    }
    if (state === 'forming' || state === 'formed' || state === 'transition') {
      this.returnState = state === 'formed' ? 'idle' : 'idle';
      return;
    }
    this.state = state;
  }

  /**
   * Particle roar impulse. Entrance sequence calls once automatically for Manager.
   * Public for future interaction hooks — does not schedule repeats.
   */
  triggerRoar(durationMs?: number): void {
    if (!this.agent.entrance.roarOnce && durationMs == null) {
      // Non-lion agents: allow explicit roar only if caller passes duration
      // (kept for API symmetry; AgentsView does not call this).
    }
    if (this.state !== 'roar') {
      this.returnState = this.state === 'forming' ? 'idle' : this.state;
    }
    this.state = 'roar';
    this.roarStart = performance.now();
    const range = this.agent.entrance.roarDurationMs ?? [700, 1200];
    this.roarDuration = durationMs ?? randRange(range);

    for (const p of this.particles) {
      const isMane = p.zone === 'mane' ? 1 : 0;
      const isMuzzle = p.zone === 'muzzle' ? 1 : 0;
      const kick =
        0.08 +
        p.rim * 0.2 +
        isMane * 0.1 +
        isMuzzle * 0.07 +
        hash01(p.seed * 8) * 0.08;
      const a = Math.atan2(p.by, p.bx) + (hash01(p.seed * 3) - 0.5) * 0.9;
      p.vx += Math.cos(a) * kick;
      p.vy += Math.sin(a) * kick;
      p.vz += (hash01(p.seed * 5) - 0.5) * 0.08 + isMane * 0.035;
    }
  }

  resize(cssW: number, cssH: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, this.dprCap);
    const w = Math.max(1, Math.floor(cssW * this.dpr));
    const h = Math.max(1, Math.floor(cssH * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  start(): void {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.t0 = performance.now();
    this.lastFrameAt = 0;
    if (typeof document !== 'undefined') {
      this.pageVisible = document.visibilityState !== 'hidden';
    }
    const loop = (now: number) => {
      if (this.destroyed || !this.running) return;
      const active = !this.paused && this.visible && this.pageVisible;
      if (active) {
        const minGap = this.frameIntervalMs;
        if (now - this.lastFrameAt >= minGap) {
          this.lastFrameAt = now;
          this.tick(now);
        }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Pause simulation when canvas is off-screen or section hidden.
   * Keeps last drawn frame (no clear) to avoid flicker/disappearance. */
  setActive(active: boolean): void {
    this.paused = !active;
  }

  setInView(inView: boolean): void {
    this.visible = inView;
  }

  setPageVisible(visible: boolean): void {
    this.pageVisible = visible;
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    const gl = this.gl;
    try {
      gl.deleteBuffer(this.bufPos);
      gl.deleteBuffer(this.bufCol);
      gl.deleteBuffer(this.bufSize);
      gl.deleteProgram(this.program);
    } catch {
      /* ignore */
    }
  }

  private roarEnvelope(now: number): number {
    if (this.roarStart < 0) return 0;
    const u = (now - this.roarStart) / this.roarDuration;
    if (u >= 1) {
      this.roarStart = -1;
      this.state = this.returnState === 'roar' ? 'idle' : this.returnState;
      return 0;
    }
    if (u < 0.17) return (u / 0.17) * 0.65;
    if (u < 0.42) return 0.65 + ((u - 0.17) / 0.25) * 0.35;
    if (u < 0.75) return 1 - ((u - 0.42) / 0.33) * 0.72;
    return 0.28 * (1 - (u - 0.75) / 0.25);
  }

  private tick(now: number): void {
    if (!this.posArr || !this.colArr || !this.sizeArr || this.particles.length === 0) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      return;
    }

    const t = (now - this.t0) / 1000;
    const formT = Math.min(1, Math.max(0, (now - this.formStart) / this.formDuration));
    if (formT >= 1 && this.forming) {
      this.forming = false;
      if (this.state === 'forming') this.state = 'idle';
    }

    if (
      !this.forming &&
      !this.entranceRoarDone &&
      this.entranceRoarAt > 0 &&
      now >= this.entranceRoarAt &&
      this.state !== 'roar'
    ) {
      this.entranceRoarDone = true;
      this.entranceRoarAt = -1;
      this.triggerRoar();
    }

    const formPull =
      formT < 0.28
        ? 0.18 + (formT / 0.28) * 0.4
        : formT < 0.6
          ? 0.58 + ((formT - 0.28) / 0.32) * 0.3
          : 0.88 + ((formT - 0.6) / 0.4) * 0.12;
    const formDamp = formT < 0.45 ? 0.86 : 0.72;
    const overshoot =
      formT > 0.35 && formT < 0.65 ? (1 - Math.abs(formT - 0.5) / 0.15) * 0.028 : 0;

    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const roar = this.state === 'roar' ? this.roarEnvelope(now) : 0;
    const activeState = this.state === 'roar' ? this.returnState : this.state;
    const m = this.agent.motion;
    const behavior = this.agent.behavior;

    let flow = m.flow;
    let orbit = m.orbit;
    let breath = m.breathing;
    let turb = m.turbulence;
    let brightMul = 1;
    let sizeMul = 1;
    let loose = m.looseZoneMul;
    let faceActivity = m.faceStability;
    let pulse = 0;

    switch (activeState) {
      case 'thinking':
        flow *= 1.25;
        orbit *= 1.2;
        turb *= 1.4;
        brightMul = 1.08;
        break;
      case 'listening':
        flow *= 1.15;
        breath *= 1.3;
        brightMul = 1.12;
        sizeMul = 1.03;
        break;
      case 'speaking':
        pulse = 0.5 + 0.5 * Math.sin(t * 6.2);
        flow *= 1.4 + pulse * 0.25;
        orbit *= 1.25;
        brightMul = 1.08 + pulse * 0.06;
        sizeMul = 1.04 + pulse * 0.04;
        break;
      case 'error':
        flow *= 0.3;
        orbit *= 0.35;
        turb *= 0.25;
        brightMul = 0.75;
        break;
      default:
        break;
    }

    if (roar > 0) {
      flow += roar * 0.9;
      orbit += roar * 0.022;
      turb += roar * 0.016;
      brightMul += roar * 0.16;
      sizeMul += roar * 0.08;
      loose += roar * 0.65;
    }

    if (reduced) {
      flow *= 0.2;
      orbit *= 0.25;
      breath *= 0.25;
      turb = 0;
    }

    if (this.forming) {
      flow *= 0.35 + formT * 0.65;
      orbit *= 0.25 + formT * 0.75;
      turb *= formT;
    }

    const n = this.particles.length;
    const depthMul = m.depthMovement;

    for (let i = 0; i < n; i++) {
      const p = this.particles[i];
      const phase = p.phase;

      const def = deformTarget(p, t, behavior);
      let bx = def.x;
      let by = def.y;
      let bz = def.z;

      const rr = Math.hypot(p.bx, p.by) + 1e-5;
      const nx = p.bx / rr;
      const ny = p.by / rr;
      const faceTight = 1 - p.rim * 0.55;

      const localOrbit =
        orbit *
        (0.55 + p.localWeight * loose * 0.35) *
        (0.65 + 0.35 * Math.sin(t * flow + phase));
      const ang = t * flow * 2.0 + phase;
      const ox = Math.cos(ang) * localOrbit * faceTight;
      const oy = Math.sin(ang * 1.17 + 0.3) * localOrbit;

      const noise =
        turb *
        (Math.sin(t * 2.4 + phase * 2.0 + p.bx * 8) * 0.5 +
          Math.sin(t * 3.8 - phase + p.by * 6) * 0.5) *
        (0.45 + p.rim * 1.05 + p.localWeight * 0.25);

      const breathe =
        breath * Math.sin(t * 1.45 + phase * 0.3 + rr * 1.4) * (0.5 + p.rim * 0.85);

      const isMane = p.zone === 'mane' ? 1 : 0;
      const isMuzzle = p.zone === 'muzzle' ? 1 : 0;
      const isEye = p.zone === 'eye' ? 1 : 0;

      const roarRad =
        roar *
        (0.055 + p.rim * 0.22 + isMane * 0.16) *
        (0.55 + Math.sin(rr * 10 - t * 18 + phase) * 0.45);
      const roarVib = roar * (1 - p.rim * 0.5) * 0.042 * Math.sin(t * 56 + phase * 11);
      const roarMouth = roar * isMuzzle * 0.09 * Math.sin(t * 28 + phase);

      bx += ox + nx * (breathe + roarRad + roarMouth) + ny * noise;
      by += oy + ny * (breathe + roarRad) + nx * noise + roarVib;
      bz +=
        Math.sin(ang * 0.65 + phase) * localOrbit * depthMul +
        roar * (0.04 + isMane * 0.08 + isMuzzle * 0.03);

      if (this.forming && overshoot > 0) {
        bx += nx * overshoot * (0.5 + p.rim);
        by += ny * overshoot * (0.5 + p.rim);
      }

      const spring = this.forming
        ? formPull
        : roar > 0.35
          ? 0.22
          : m.spring + faceTight * 0.08;
      const damp = this.forming ? formDamp : roar > 0.35 ? 0.82 : m.damp;

      p.vx += (bx - p.x) * spring;
      p.vy += (by - p.y) * spring;
      p.vz += (bz - p.z) * spring;
      p.vx *= damp;
      p.vy *= damp;
      p.vz *= damp;
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      // Hard leash — prevents OPS/creature collapse & runaway streaks
      const dx = p.x - p.bx;
      const dy = p.y - p.by;
      const dz = p.z - p.bz;
      const maxDist = this.forming ? 2.4 : 0.42 + p.rim * 0.28 + (p.localWeight > 1.2 ? 0.18 : 0);
      const dist = Math.hypot(dx, dy, dz);
      if (dist > maxDist) {
        const s = maxDist / dist;
        p.x = p.bx + dx * s;
        p.y = p.by + dy * s;
        p.z = p.bz + dz * s;
        p.vx *= 0.5;
        p.vy *= 0.5;
        p.vz *= 0.5;
      }

      const oi = i * 3;
      this.posArr[oi] = p.x;
      this.posArr[oi + 1] = p.y;
      this.posArr[oi + 2] = p.z;

      const twinkle = 1 + 0.28 * Math.sin(t * 5.4 + phase * 2.7) * (0.5 + p.seed);
      const eyeBoost = 1 + isEye * (0.22 + roar * 0.7) * faceActivity;
      const ci = i * 4;
      this.colArr[ci] = Math.min(1, p.r * brightMul * twinkle * eyeBoost);
      this.colArr[ci + 1] = Math.min(1, p.g * brightMul * twinkle * eyeBoost);
      this.colArr[ci + 2] = Math.min(1, p.b * brightMul * twinkle * (1 + isEye * roar * 0.35));
      this.colArr[ci + 3] = Math.min(
        1,
        p.a * (0.8 + pulse * 0.1 + roar * 0.2 + 0.12 * Math.sin(t * 3.6 + phase)),
      );

      this.sizeArr[i] =
        p.baseSize *
        sizeMul *
        (0.85 + 0.28 * Math.sin(t * 3.1 + phase) + isEye * 0.15 + roar * (0.12 + p.rim * 0.28));
    }

    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    const pointScale = Math.max(1.05, (this.cssW / 168) * this.dpr * 1.28);
    gl.uniform1f(this.uPointScale, pointScale);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPos);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.posArr);
    gl.enableVertexAttribArray(this.locPos);
    gl.vertexAttribPointer(this.locPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCol);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.colArr);
    gl.enableVertexAttribArray(this.locCol);
    gl.vertexAttribPointer(this.locCol, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSize);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sizeArr);
    gl.enableVertexAttribArray(this.locSize);
    gl.vertexAttribPointer(this.locSize, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, n);
  }
}
