'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LivingParticleEngine,
  detectDeviceProfile,
  requireAgent,
  resolveAgentId,
  type AgentVisualState,
  type ParticleMetal,
  type QualityLevel,
} from '@/lib/living-particle';

export type LivingAgentState = Exclude<AgentVisualState, 'roar' | 'forming' | 'formed' | 'transition'>;

type Props = {
  /** Agent id or alias (manager, mian, ops, analyst, scrape, social). */
  agent: string;
  state?: LivingAgentState;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  label?: string;
  size?: number;
  /** Override metal. Defaults to agent definition. */
  metal?: ParticleMetal;
  /**
   * Hero / featured: enable one-time entrance roar when agent allows it.
   * Manager lion only roars once on entrance.
   */
  entranceRoar?: boolean;
  quality?: QualityLevel;
  maxParticles?: number;
};

/**
 * Registry-driven living particle creature.
 * Animation runs outside React. Pauses when off-screen or tab hidden.
 */
export function LivingParticleAgent({
  agent: agentKey,
  state = 'idle',
  className,
  interactive,
  onClick,
  label,
  size = 168,
  metal,
  entranceRoar = false,
  quality,
  maxParticles,
}: Props) {
  const wrapRef = useRef<HTMLButtonElement | HTMLSpanElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<LivingParticleEngine | null>(null);
  const [failed, setFailed] = useState(false);

  const resolvedId = resolveAgentId(agentKey) ?? agentKey.toLowerCase();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let engine: LivingParticleEngine | null = null;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;

    const onVis = () => {
      engineRef.current?.setPageVisible(document.visibilityState !== 'hidden');
    };

    (async () => {
      try {
        const def = requireAgent(resolvedId);
        const agentDef = metal && metal !== def.metal ? { ...def, metal } : def;
        const profile = detectDeviceProfile(size);
        const q = quality ?? profile.quality;

        // Chat avatars stay lite; hero/Agents get higher but still device-capped.
        const autoCap =
          maxParticles ??
          (size <= 40
            ? Math.min(1600, profile.particleCap)
            : size <= 80
              ? Math.min(5000, profile.particleCap)
              : entranceRoar
                ? Math.min(22000, profile.particleCap)
                : size >= 220
                  ? Math.min(24000, profile.particleCap)
                  : Math.min(14000, profile.particleCap));

        engine = LivingParticleEngine.create(canvas, {
          agent: agentDef,
          entranceRoar,
          quality: q,
          maxParticles: autoCap,
          onReady: (count) => {
            if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
              console.info(
                `[LivingParticle] ${agentDef.id} ${agentDef.metal} ${count}p q=${q}`,
              );
            }
          },
        });
        if (cancelled) {
          engine.destroy();
          return;
        }
        engineRef.current = engine;

        const applySize = () => {
          const el = wrapRef.current;
          if (!el || !engine) return;
          const rect = el.getBoundingClientRect();
          engine.resize(rect.width || size, rect.height || size);
        };

        applySize();
        await engine.init();
        if (cancelled) {
          engine.destroy();
          return;
        }
        engine.setState(state);
        applySize();
        engine.start();

        ro = new ResizeObserver(() => applySize());
        if (wrapRef.current) ro.observe(wrapRef.current);

        // Assume visible until IO reports otherwise (avoids first-frame blank clear).
        engine.setInView(true);
        engine.setActive(true);

        if (typeof IntersectionObserver !== 'undefined' && wrapRef.current) {
          io = new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              const inView = Boolean(entry?.isIntersecting);
              engineRef.current?.setInView(inView);
              engineRef.current?.setActive(inView);
            },
            { threshold: 0, rootMargin: '80px' },
          );
          io.observe(wrapRef.current);
        }

        document.addEventListener('visibilitychange', onVis);
      } catch (err) {
        console.error('[LivingParticle] WebGL unavailable', err);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      ro?.disconnect();
      io?.disconnect();
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId, metal, entranceRoar, size, quality, maxParticles]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setState(state);
  }, [state]);

  const Tag = interactive ? 'button' : 'span';
  const metalClass = metal ?? (resolvedId === 'manager' && entranceRoar ? 'gold' : undefined);

  return (
    <Tag
      ref={wrapRef as never}
      type={interactive ? 'button' : undefined}
      className={`hx-living-agent hx-great-lion${metalClass ? ` metal-${metalClass}` : ''} state-${state}${entranceRoar ? ' is-hero' : ''}${failed ? ' is-failed' : ''} ${className ?? ''}`}
      style={{ width: size, height: size }}
      onClick={interactive ? onClick : undefined}
      aria-label={label ?? `HARVYX ${resolvedId} ${state}`}
    >
      <canvas ref={canvasRef} className="hx-great-lion-canvas" aria-hidden />
    </Tag>
  );
}
