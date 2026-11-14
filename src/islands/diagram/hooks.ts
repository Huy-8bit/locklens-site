import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';

/* ------------------------------------------------------------------ */
/* Media queries                                                      */
/* ------------------------------------------------------------------ */

export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

/* ------------------------------------------------------------------ */
/* Visibility: pause expensive animation while offscreen               */
/* ------------------------------------------------------------------ */

export function useInView<T extends Element>(ref: RefObject<T | null>, rootMargin = '120px'): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

/** Pauses/resumes SMIL animations (animateMotion particles) of an SVG. */
export function useSvgAnimationControl(svgRef: RefObject<SVGSVGElement | null>, running: boolean) {
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      if (running) svg.unpauseAnimations();
      else svg.pauseAnimations();
    } catch {
      /* SMIL unsupported: nothing to pause */
    }
  }, [svgRef, running]);
}

/* ------------------------------------------------------------------ */
/* Step sequencer                                                     */
/* ------------------------------------------------------------------ */

export interface Stepper {
  step: number; // -1 = overview / not started
  playing: boolean;
  count: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
  replay: () => void;
  goTo: (i: number) => void;
}

/**
 * Deterministic step machine. Visual state is derived from `step` only,
 * so stepping backwards or resetting can never leave a scene inconsistent.
 */
export function useStepper(count: number, durations: number | number[], opts: { active?: boolean } = {}): Stepper {
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const active = opts.active ?? true;
  const dur = useCallback((i: number) => (Array.isArray(durations) ? (durations[i] ?? 4000) : durations), [durations]);

  useEffect(() => {
    if (!playing || !active) return;
    if (step >= count - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setStep((s) => Math.min(count - 1, s + 1)), step < 0 ? 250 : dur(step));
    return () => window.clearTimeout(t);
  }, [playing, active, step, count, dur]);

  return {
    step,
    playing,
    count,
    play: () => {
      if (step >= count - 1) setStep(-1);
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    toggle: () => {
      if (playing) setPlaying(false);
      else {
        if (step >= count - 1) setStep(-1);
        setPlaying(true);
      }
    },
    next: () => {
      setPlaying(false);
      setStep((s) => Math.min(count - 1, s + 1));
    },
    prev: () => {
      setPlaying(false);
      setStep((s) => Math.max(-1, s - 1));
    },
    reset: () => {
      setPlaying(false);
      setStep(-1);
    },
    replay: () => {
      setStep(-1);
      setPlaying(true);
    },
    goTo: (i: number) => {
      setPlaying(false);
      setStep(Math.max(-1, Math.min(count - 1, i)));
    },
  };
}

/* ------------------------------------------------------------------ */
/* Zoom & pan on an SVG viewBox                                        */
/* ------------------------------------------------------------------ */

export interface ZoomPan {
  viewBox: string;
  scale: number;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  /** True while (or right after) the user dragged: suppress node clicks. */
  wasDragged: () => boolean;
  bind: {
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => void;
  };
}

export function useZoomPan(svgRef: RefObject<SVGSVGElement | null>, width: number, height: number, { min = 1, max = 3.2 } = {}): ZoomPan {
  const [vb, setVb] = useState({ x: 0, y: 0, w: width, h: height });
  const drag = useRef<{ id: number; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const dragged = useRef(false);

  useEffect(() => setVb({ x: 0, y: 0, w: width, h: height }), [width, height]);

  const clamp = useCallback(
    (v: { x: number; y: number; w: number; h: number }) => {
      const w = Math.min(width / min, Math.max(width / max, v.w));
      const h = (w / width) * height;
      const x = Math.min(width - w * 0.25, Math.max(-w * 0.75, v.x));
      const y = Math.min(height - h * 0.25, Math.max(-h * 0.75, v.y));
      return { x, y, w, h };
    },
    [width, height, min, max],
  );

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      setVb((v) => {
        const px = cx ?? v.x + v.w / 2;
        const py = cy ?? v.y + v.h / 2;
        const w = v.w / factor;
        const h = v.h / factor;
        return clamp({ x: px - ((px - v.x) / v.w) * w, y: py - ((py - v.y) / v.h) * h, w, h });
      });
    },
    [clamp],
  );

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms; plain wheel scrolls the page.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      setVb((v) => {
        const px = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
        const py = v.y + ((e.clientY - rect.top) / rect.height) * v.h;
        const factor = Math.exp(-e.deltaY * 0.0022);
        const w = v.w / factor;
        const h = v.h / factor;
        return clamp({ x: px - ((px - v.x) / v.w) * w, y: py - ((py - v.y) / v.h) * h, w, h });
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [svgRef, clamp]);

  const scale = width / vb.w;

  return {
    viewBox: `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`,
    scale,
    zoomIn: () => zoomAt(1.25),
    zoomOut: () => zoomAt(1 / 1.25),
    fit: () => setVb({ x: 0, y: 0, w: width, h: height }),
    wasDragged: () => dragged.current,
    bind: {
      onPointerDown: (e) => {
        if (e.button !== 0) return;
        dragged.current = false;
        drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y, moved: false };
      },
      onPointerMove: (e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.sx;
        const dy = e.clientY - d.sy;
        if (!d.moved && Math.hypot(dx, dy) < 5) return;
        if (!d.moved) {
          d.moved = true;
          dragged.current = true;
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        }
        // Panning only makes sense when zoomed in.
        if (scale <= 1.001) return;
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const k = vb.w / rect.width;
        setVb((v) => clamp({ ...v, x: d.vx - dx * k, y: d.vy - dy * k }));
      },
      onPointerUp: (e) => {
        if (drag.current?.moved) (e.currentTarget as SVGSVGElement).releasePointerCapture?.(e.pointerId);
        drag.current = null;
        window.setTimeout(() => (dragged.current = false), 0);
      },
      onPointerCancel: () => {
        drag.current = null;
        dragged.current = false;
      },
    },
  };
}
