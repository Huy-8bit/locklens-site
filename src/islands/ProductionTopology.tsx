import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Focus, MousePointerClick, Play, Power, RotateCcw, Info } from 'lucide-react';
import { CANVAS, CLUSTERS, EDGES, FRAMES, GROUPS, MODES, MODE_COPY, NODES, type ClusterId, type Mode, type TopoEdge, type TopoNode } from './data/topology';
import { FLOWS, type FlowKind } from './diagram/flows';
import { easeInOut, lerp, route, type Pt, type Rect, type Route } from './diagram/geometry';
import { useInView, useReducedMotion, useSvgAnimationControl, useZoomPan } from './diagram/hooks';
import { DiagramDefs, DiagramEdge, DiagramGroup, DiagramNode, Legend, TONES } from './diagram/primitives';
import { icon } from './diagram/icons';
import { DetailsPanel, ZoomControls, siteUrl } from './diagram/ui';

const DEFS = 'pt';
const NW = 176;
const NH = 50;
const nodeById = new Map(NODES.map((n) => [n.id, n]));

type Box = { x: number; y: number; w: number; h: number; o: number };
type Layout = Record<string, Box>;

/* ------------------------------------------------------------------ */
/* Layout per mode + tween                                            */
/* ------------------------------------------------------------------ */

function targetLayout(mode: Mode, prev: Layout | null): Layout {
  const out: Layout = {};
  for (const n of NODES) {
    const p = n.at[mode];
    if (p) out[n.id] = { x: p.x, y: p.y, w: p.w ?? NW, h: p.h ?? NH, o: 1 };
    else {
      const keep = prev?.[n.id] ?? firstPlacement(n);
      out[n.id] = { ...keep, o: 0 };
    }
  }
  for (const g of GROUPS) {
    const p = g.at[mode];
    if (p) out[g.id] = { x: p.x, y: p.y, w: p.w, h: p.h, o: 1 };
    else {
      const keep = prev?.[g.id] ?? firstGroup(g.at);
      out[g.id] = { ...keep, o: 0 };
    }
  }
  for (const e of EDGES) out[`e:${e.id}`] = { x: 0, y: 0, w: 0, h: 0, o: e.modes.includes(mode) ? 1 : 0 };
  const f = FRAMES[mode];
  out.__frame = { x: f.x, y: f.y, w: f.w, h: (f.w * CANVAS.h) / CANVAS.w, o: 1 };
  return out;
}
function firstPlacement(n: TopoNode): Box {
  const p = Object.values(n.at)[0]!;
  return { x: p.x, y: p.y, w: p.w ?? NW, h: p.h ?? NH, o: 0 };
}
function firstGroup(at: Record<string, { x: number; y: number; w: number; h: number }>): Box {
  const p = Object.values(at)[0]!;
  return { ...p, o: 0 };
}

function useTweenedLayout(target: Layout, reduced: boolean, duration = 850): Layout {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  useEffect(() => {
    if (reduced) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }
    const from = displayRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = easeInOut(t);
      const next: Layout = {};
      for (const id of Object.keys(target)) {
        const a = from[id] ?? target[id];
        const b = target[id];
        // Fade out first, then move; fade in after moving (feels like a morph, not a jump cut).
        const ko = b.o > a.o ? Math.max(0, (t - 0.35) / 0.65) : Math.min(1, t / 0.5);
        next[id] = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k), o: lerp(a.o, b.o, ko) };
      }
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, duration]);
  return display;
}

/* ------------------------------------------------------------------ */
/* Routing                                                            */
/* ------------------------------------------------------------------ */

const BUS_Y: Record<Mode, number> = { single: 420, cluster: 516, fleet: 522, ha: 516 };

function monitorRoute(src: Rect, dst: Rect, lane: 'primary' | 'replica' | 'single', mode: Mode, serverIndex: number): Route {
  const scx = src.x + src.w / 2;
  const dcx = dst.x + dst.w / 2;
  if (Math.abs(scx - dcx) < 40) return route(src, dst, { from: 'b', to: 't' });
  const laneX = lane === 'replica' ? src.x - 30 : src.x - 14;
  const y0 = src.y + src.h / 2 + 10;
  const busY = BUS_Y[mode] + serverIndex * 12;
  const entryX = dcx + (lane === 'replica' ? 22 : -22);
  const via: Pt[] = [
    { x: laneX, y: y0 },
    { x: laneX, y: busY },
    { x: entryX, y: busY },
  ];
  return route(src, dst, { from: 'l', to: 't', toOffset: entryX - dcx, fromOffset: 10, via });
}

function hintedRoute(a: Rect, b: Rect, hint: 'over' | 'under', overY?: number): Route {
  const sx = a.x + a.w + 24;
  const sy = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  if (hint === 'over') {
    // Run horizontally above the obstacle and enter the target from its left side.
    const y = overY ?? b.y + b.h / 2;
    return route(a, b, { from: 'r', to: 'l', toOffset: y - (b.y + b.h / 2), via: [{ x: sx, y: sy }, { x: sx, y }] });
  }
  const yBot = b.y + b.h + 18;
  return route(a, b, { from: 'r', to: 'b', via: [{ x: sx, y: sy }, { x: sx, y: yBot }, { x: bx, y: yBot }] });
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

type Visibility = Record<'app' | 'collect' | 'repl' | 'alert', boolean>;
type Phase = 'all' | 'app' | 'collect' | 'deliver' | 'alert';
const PHASES: { id: Phase; caption: string }[] = [
  { id: 'app', caption: '1 · Application traffic flows through your own infrastructure.' },
  { id: 'collect', caption: '2 · Separately, LockLens reads PostgreSQL statistics over its own read-only connections.' },
  { id: 'deliver', caption: '3 · It stores history in its own store; engineers read it through the LockLens frontend.' },
  { id: 'alert', caption: '4 · Incidents and metrics leave LockLens only to destinations you configure.' },
];
const PHASE_KINDS: Record<Phase, FlowKind[]> = {
  all: ['app', 'collect', 'repl', 'store', 'api', 'alert'],
  app: ['app', 'repl'],
  collect: ['collect'],
  deliver: ['store', 'api'],
  alert: ['alert'],
};

type Crash = 'none' | 'down' | 'reassigned';

export default function ProductionTopology({ initialMode = 'cluster', compact = false }: { initialMode?: Mode; compact?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(wrapRef);
  const reduced = useReducedMotion();
  const zp = useZoomPan(svgRef, CANVAS.w, CANVAS.h);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [vis, setVis] = useState<Visibility>({ app: true, collect: true, repl: true, alert: true });
  const [focusMonitoring, setFocusMonitoring] = useState(false);
  const [cluster, setCluster] = useState<ClusterId | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('all');
  const [crash, setCrash] = useState<Crash>('none');
  const [countdown, setCountdown] = useState(45);

  // Deep link (/architecture/?mode=fleet#production) and the page's persistent mode selector.
  useEffect(() => {
    const valid = (m: unknown): m is Mode => typeof m === 'string' && MODES.some((x) => x.id === m);
    const fromUrl = new URLSearchParams(window.location.search).get('mode');
    const pending = (window as unknown as { __locklensMode?: string }).__locklensMode;
    if (valid(pending)) setMode(pending);
    else if (valid(fromUrl)) setMode(fromUrl);
    const onSet = (e: Event) => {
      const m = (e as CustomEvent<string>).detail;
      if (valid(m)) {
        setMode(m);
        setSelected(null);
        setCrash('none');
      }
    };
    window.addEventListener('locklens:set-mode', onSet);
    return () => window.removeEventListener('locklens:set-mode', onSet);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('locklens:mode-changed', { detail: mode }));
  }, [mode]);

  const layoutRef = useRef<Layout | null>(null);
  const target = useMemo(() => {
    const t = targetLayout(mode, layoutRef.current);
    layoutRef.current = t;
    return t;
  }, [mode]);
  const L = useTweenedLayout(target, reduced);

  const changeMode = (m: Mode) => {
    setMode(m);
    setSelected(null);
    setCrash('none');
    if (cluster && !CLUSTERS.find((c) => c.id === cluster)?.modes.includes(m)) setCluster(null);
  };

  // Replay: walk through the four flow phases, then show everything.
  const replay = () => {
    setPhase('app');
  };
  useEffect(() => {
    if (phase === 'all') return;
    const order: Phase[] = ['app', 'collect', 'deliver', 'alert', 'all'];
    const t = window.setTimeout(() => setPhase(order[order.indexOf(phase) + 1]), reduced ? 3200 : 2800);
    return () => window.clearTimeout(t);
  }, [phase, reduced]);

  // Lease takeover simulation (multi-instance mode).
  useEffect(() => {
    if (crash !== 'down') return;
    setCountdown(45);
    const started = performance.now();
    const iv = window.setInterval(() => {
      const left = Math.max(0, 45 - Math.round(((performance.now() - started) / 4500) * 45));
      setCountdown(left);
      if (left === 0) {
        window.clearInterval(iv);
        window.setTimeout(() => setCrash('reassigned'), 600);
      }
    }, 100);
    return () => window.clearInterval(iv);
  }, [crash]);

  const animate = inView && !reduced;
  useSvgAnimationControl(svgRef, animate);

  // ---- which server collects which target (only differs in 'ha')
  const serverFor = (e: TopoEdge): string => {
    if (mode !== 'ha') return 'll-a';
    const owner = e.monitor?.serverByMode?.ha ?? 'll-a';
    if (crash !== 'none' && owner === 'll-b') {
      if (crash === 'down') return 'none';
      return e.id === 'm-payments' ? 'll-a' : 'll-c';
    }
    return owner;
  };

  // ---- highlight set
  const highlight = useMemo(() => {
    if (selected) {
      const ids = new Set<string>([selected]);
      for (const e of EDGES) if (e.modes.includes(mode) && (e.from === selected || e.to === selected)) ids.add(e.from).add(e.to).add(`e:${e.id}`);
      return ids;
    }
    if (cluster) {
      const ids = new Set<string>();
      for (const n of NODES) if (n.cluster === cluster) ids.add(n.id);
      ids.add(`grp-${cluster}`);
      // Walk application edges backwards: database → pooler → services → entry → clients.
      let frontier = new Set(ids);
      for (let depth = 0; depth < 5 && frontier.size; depth++) {
        const next = new Set<string>();
        for (const e of EDGES) {
          if (!e.modes.includes(mode) || e.kind !== 'app' || !frontier.has(e.to)) continue;
          ids.add(`e:${e.id}`);
          if (!ids.has(e.from)) next.add(e.from);
        }
        next.forEach((x) => ids.add(x));
        frontier = next;
      }
      for (const e of EDGES) {
        if (!e.modes.includes(mode)) continue;
        if ((e.kind === 'collect' || e.kind === 'repl') && nodeById.get(e.from)?.cluster === cluster) {
          ids.add(`e:${e.id}`);
          ids.add(serverFor(e));
        }
      }
      ids.add('ll-store');
      ids.add('grp-ll');
      return ids;
    }
    if (focusMonitoring) {
      const ids = new Set<string>();
      for (const n of NODES) if (n.layer === 'locklens' || n.layer === 'db' || n.layer === 'people' || n.layer === 'external') ids.add(n.id);
      for (const e of EDGES) if (e.kind !== 'app') ids.add(`e:${e.id}`);
      ['grp-ll', 'grp-commerce', 'grp-payments', 'grp-reporting'].forEach((g) => ids.add(g));
      return ids;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, cluster, focusMonitoring, mode, crash]);

  const dimmed = (id: string) => (highlight ? !highlight.has(id) : false);

  const kindVisible = (k: FlowKind) => {
    if (k === 'app') return vis.app;
    if (k === 'collect') return vis.collect;
    if (k === 'repl') return vis.repl;
    if (k === 'alert') return vis.alert;
    return true;
  };

  const rectOf = (id: string): Rect => {
    const b = L[id];
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  };

  const serverIndex: Record<string, number> = { 'll-a': 0, 'll-b': 1, 'll-c': 2 };

  const edgesToDraw = EDGES.map((e) => {
    const eo = L[`e:${e.id}`]?.o ?? 0;
    let toId = e.to;
    if (e.monitor) toId = serverFor(e);
    if (toId === 'none') return null;
    if (mode === 'ha' && crash === 'down' && (e.from === 'll-b' || e.to === 'll-b')) return null;
    const a = rectOf(e.from);
    const b = rectOf(toId);
    const nodeO = Math.min(L[e.from]?.o ?? 0, L[toId]?.o ?? 0);
    const o = Math.min(eo, nodeO);
    if (o < 0.02) return null;
    let r: Route;
    if (e.monitor) r = monitorRoute(a, b, e.monitor.lane, mode, mode === 'ha' ? serverIndex[toId] ?? 0 : 0);
    else if (e.routeHint) r = hintedRoute(a, b, e.routeHint, e.overY?.[mode]);
    else r = route(a, b);
    const vis = kindVisible(e.kind) ? 1 : 0;
    const dim = dimmed(`e:${e.id}`);
    const phaseOn = PHASE_KINDS[phase].includes(e.kind);
    return { e, r, o: o * vis * (dim ? 0.12 : 1), active: !dim && phaseOn && vis > 0, kind: e.kind, toId };
  }).filter(Boolean) as { e: TopoEdge; r: Route; o: number; active: boolean; kind: FlowKind; toId: string }[];

  const sel = selected ? nodeById.get(selected) : undefined;
  const copy = MODE_COPY[mode];
  const phaseCaption = PHASES.find((p) => p.id === phase)?.caption;

  const serverColor: Record<string, string> = { 'll-a': '#087f5b', 'll-b': '#f472b6', 'll-c': '#a3e635' };

  return (
    <div ref={wrapRef} className="pt-root">
      {/* Mode selector */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Architecture mode" className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-ink-900/70 p-1 sm:inline-grid sm:grid-cols-4">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => changeMode(m.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[0.82rem] transition-colors ${mode === m.id ? 'bg-accent/12 text-fg ring-1 ring-accent/45' : 'text-fg-muted hover:bg-ink-800 hover:text-fg'}`}
            >
              <span className={`grid size-5 shrink-0 place-items-center rounded-md font-mono text-[0.68rem] ${mode === m.id ? 'bg-accent text-ink-950' : 'bg-ink-700 text-fg-subtle'}`}>{m.short}</span>
              {m.label}
            </button>
          ))}
        </div>
        <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
          <button type="button" className="ctrl" onClick={replay} disabled={phase !== 'all'}>
            <Play size={13} aria-hidden /> Replay data flow
          </button>
          <button type="button" className="ctrl" aria-pressed={focusMonitoring} onClick={() => { setFocusMonitoring((f) => !f); setCluster(null); setSelected(null); }}>
            <Focus size={13} aria-hidden /> Highlight LockLens connections
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="panel relative mt-4 hidden overflow-hidden lg:block">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Show or hide traffic types">
            {(
              [
                ['app', 'App traffic'],
                ['collect', 'Monitoring'],
                ['repl', 'Replication'],
                ['alert', 'Alerts & telemetry'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" className="ctrl" aria-pressed={vis[k]} onClick={() => setVis((v) => ({ ...v, [k]: !v[k] }))}>
                {vis[k] ? <Eye size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />}
                <svg width="18" height="6" aria-hidden="true">
                  <line x1="1" y1="3" x2="17" y2="3" stroke={FLOWS[k].color} strokeWidth="2" strokeDasharray={FLOWS[k].dash} />
                </svg>
                {label}
              </button>
            ))}
          </div>
          {mode !== 'single' && (
            <label className="flex items-center gap-2 text-[0.78rem] text-fg-muted">
              Cluster
              <select
                className="h-8 rounded-lg border border-line bg-ink-900 px-2 text-[0.78rem] text-fg"
                value={cluster ?? ''}
                onChange={(e) => {
                  setCluster((e.target.value || null) as ClusterId | null);
                  setSelected(null);
                  setFocusMonitoring(false);
                }}
              >
                <option value="">All</option>
                {CLUSTERS.filter((c) => c.modes.includes(mode)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="ml-auto">
            <ZoomControls zp={zp} />
          </div>
        </div>

        <div className="relative">
          {phase !== 'all' && (
            <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-accent/40 bg-ink-900/95 px-4 py-2 text-sm text-accent shadow-lg shadow-emerald-950/10" aria-live="polite">
              {phaseCaption}
            </p>
          )}
          <svg
            ref={svgRef}
            viewBox={zp.viewBox}
            className={`diagram-svg block h-auto w-full ${animate ? '' : 'dg-paused'}`}
            style={{ aspectRatio: `${CANVAS.w} / ${CANVAS.h}`, touchAction: zp.scale > 1 ? 'none' : 'pan-y', cursor: zp.scale > 1 ? 'grab' : 'default' }}
            role="group"
            aria-label={`Production architecture: ${MODES.find((m) => m.id === mode)?.label}. ${copy.lead}`}
            {...zp.bind}
          >
            <DiagramDefs id={DEFS} />
            <rect x={-2000} y={-2000} width={6000} height={6000} fill={`url(#${DEFS}-grid)`} />
            <g transform={`scale(${CANVAS.w / L.__frame.w}) translate(${-L.__frame.x} ${-L.__frame.y})`}>
            {GROUPS.map((g) => {
              const b = L[g.id];
              if (!b || b.o < 0.02) return null;
              const p = g.at[mode];
              const isCluster = Boolean(g.cluster);
              return (
                <g
                  key={g.id}
                  onClick={isCluster && !zp.wasDragged() ? () => { setCluster((c) => (c === g.cluster ? null : g.cluster!)); setSelected(null); setFocusMonitoring(false); } : undefined}
                  style={{ cursor: isCluster ? 'pointer' : undefined }}
                >
                  <DiagramGroup id={DEFS} rect={b} label={p?.label ?? g.label} sublabel={p?.sublabel ?? g.sublabel} tone={g.tone} dashed={g.dashed} badge={g.badge} opacity={b.o * (dimmed(g.id) ? 0.35 : 1)} emphasis={cluster === g.cluster && isCluster} />
                </g>
              );
            })}
            {mode === 'ha' && (
              <g style={{ opacity: L['ll-b']?.o ?? 0 }} aria-hidden="true">
                {(['ll-a', 'll-b', 'll-c'] as const).map((sid) => {
                  const b = L[sid];
                  return <rect key={sid} x={b.x} y={b.y + b.h + 5} width={b.w} height={3} rx={1.5} fill={serverColor[sid]} opacity={crash !== 'none' && sid === 'll-b' ? 0.2 : 0.9} />;
                })}
              </g>
            )}
            {edgesToDraw.map(({ e, r, o, active, kind, toId }) => (
              <g key={e.id}>
                <DiagramEdge defsId={DEFS} route={r} kind={kind} label={e.label} state={active ? 'active' : 'normal'} opacityOverride={o} animate={animate} particles={e.kind === 'app' ? 1 : 2} speed={e.kind === 'app' ? 3 : 2.4} bidirectional={e.bidirectional} />
                {mode === 'ha' && kind === 'collect' && o > 0.05 && <circle cx={r.end.x} cy={r.end.y - 6} r={3.5} fill={serverColor[toId]} opacity={o} />}
              </g>
            ))}
            {NODES.map((n) => {
              const b = L[n.id];
              if (!b || b.o < 0.02) return null;
              const p = n.at[mode];
              const down = mode === 'ha' && n.id === 'll-b' && crash !== 'none';
              const gap = mode === 'ha' && crash === 'down' && (n.id === 'pg-payments' || n.id === 'pg-payments-r1');
              return (
                <DiagramNode
                  key={n.id}
                  id={n.id}
                  defsId={DEFS}
                  rect={b}
                  title={down ? 'server B · stopped' : (p?.title ?? n.title)}
                  subtitle={down ? 'leases not renewed' : gap ? 'not collected · gap' : (p?.subtitle ?? n.subtitle)}
                  icon={icon(n.icon)}
                  tone={down ? 'slate' : gap ? 'orange' : n.tone}
                  badge={n.badge}
                  compact
                  status={n.layer === 'db' ? (gap ? 'wait' : 'ok') : down ? 'down' : null}
                  state={selected === n.id ? 'active' : 'normal'}
                  selected={selected === n.id}
                  opacityOverride={b.o * (dimmed(n.id) ? 0.25 : down ? 0.55 : 1)}
                  onSelect={(id) => {
                    if (zp.wasDragged()) return;
                    setSelected((s) => (s === id ? null : id));
                    setCluster(null);
                    setFocusMonitoring(false);
                  }}
                />
              );
            })}
            </g>
          </svg>

          {sel && (
            <aside className="absolute inset-y-3 right-3 z-20 w-[min(370px,44%)] overflow-y-auto rounded-2xl border border-line-strong bg-ink-900/95 p-5 shadow-2xl shadow-emerald-950/10 backdrop-blur-md" aria-label={`${sel.title} details`}>
              <DetailsPanel title={sel.at[mode]?.title ?? sel.title} subtitle={sel.at[mode]?.subtitle ?? sel.subtitle} details={sel.details} illustrative={sel.illustrative && sel.layer !== 'db'} onClose={() => setSelected(null)} />
            </aside>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <Legend kinds={['app', 'collect', 'repl', 'store', 'api', 'alert']} />
          <div className="flex flex-wrap gap-2">
            <p className="chip">
              <Info size={12} aria-hidden /> Services, gateways, poolers and clusters are illustrative examples
            </p>
            <p className="chip">
              <MousePointerClick size={12} aria-hidden /> Click a component or a cluster
            </p>
          </div>
        </div>
      </div>

      {/* Explanation (all viewports) */}
      <div className={`mt-4 grid gap-4 ${compact ? '' : 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'}`}>
        <div className="panel p-5" aria-live="polite">
          <p className="eyebrow">Mode {MODES.find((m) => m.id === mode)?.short}</p>
          <h3 className="mt-1.5 text-lg font-semibold text-fg">{copy.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{copy.lead}</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-fg-muted">
            {copy.points.map((p) => (
              <li key={p} className="flex gap-2.5">
                <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {copy.docs.map((d) => (
              <a key={d.href} href={siteUrl(d.href)} className="chip hover:text-fg">
                {d.label} →
              </a>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="panel border-amber-400/20 p-5">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-amber-800">Accuracy note</p>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{copy.caveat}</p>
          </div>
          {mode === 'ha' && (
            <div className="panel p-5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Lease takeover (simulated time)</p>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted" aria-live="polite">
                {crash === 'none' && 'Each server holds leases on an even share of targets (colour bar under each server). Stop server B to see what happens to its targets.'}
                {crash === 'down' && `Server B stopped. Its leases are not renewed and expire after 45 s (${countdown} s left). Until another server takes them, payments-primary and payments-replica are not collected: a gap in their history.`}
                {crash === 'reassigned' && 'Servers A and C took the expired leases on their next sync, up to an even share. Collection resumed — typically within about a minute. Around a takeover, two servers can briefly collect the same target.'}
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="ctrl" onClick={() => setCrash('down')} disabled={crash !== 'none'}>
                  <Power size={13} aria-hidden /> Stop server B
                </button>
                <button type="button" className="ctrl" onClick={() => setCrash('none')} disabled={crash === 'none'}>
                  <RotateCcw size={13} aria-hidden /> Restore
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <MobileTopology mode={mode} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phones: two stacked lanes instead of a shrunken canvas              */
/* ------------------------------------------------------------------ */

const APP_LAYERS: { layer: TopoNode['layer']; label: string }[] = [
  { layer: 'client', label: 'Clients' },
  { layer: 'entry', label: 'Entry' },
  { layer: 'service', label: 'Services' },
  { layer: 'pool', label: 'Connection pooling (optional)' },
  { layer: 'db', label: 'PostgreSQL servers' },
];

function MobileTopology({ mode }: { mode: Mode }) {
  const present = (n: TopoNode) => Boolean(n.at[mode]);
  const nodes = NODES.filter(present);
  const title = (n: TopoNode) => n.at[mode]?.title ?? n.title;
  const ll = nodes.filter((n) => n.layer === 'locklens');
  const out = nodes.filter((n) => n.layer === 'external');
  const dbs = nodes.filter((n) => n.layer === 'db');
  return (
    <div className="mt-4 space-y-3 lg:hidden">
      <section className="panel p-4" aria-label="Application path">
        <div className="flex items-center gap-2">
          <svg width="22" height="6" aria-hidden="true"><line x1="1" y1="3" x2="21" y2="3" stroke={FLOWS.app.color} strokeWidth="2" /></svg>
          <h4 className="text-sm font-semibold text-fg">Application path</h4>
          <span className="chip ml-auto">example</span>
        </div>
        <ol className="mt-3 space-y-2">
          {APP_LAYERS.map(({ layer, label }) => {
            const ns = nodes.filter((n) => n.layer === layer);
            if (!ns.length) return null;
            return (
              <li key={layer}>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{label}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ns.map((n) => (
                    <span key={n.id} className={`chip ${layer === 'db' ? 'border-accent/35 text-accent' : ''}`}>
                      {title(n)}
                    </span>
                  ))}
                </div>
                {layer !== 'db' && <div className="ml-3 mt-1 h-3 border-l border-dashed border-line-strong" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex items-center gap-2 px-2 text-xs text-accent">
        <svg width="22" height="6" aria-hidden="true"><line x1="1" y1="3" x2="21" y2="3" stroke={FLOWS.collect.color} strokeWidth="2" strokeDasharray={FLOWS.collect.dash} /></svg>
        LockLens reads {dbs.length === 1 ? 'the PostgreSQL server' : `each of the ${dbs.length} PostgreSQL servers`} over its own read-only connection{dbs.length === 1 ? '' : 's'}
      </div>

      <section className="panel border-accent/30 p-4" aria-label="LockLens">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-fg">LockLens · out of band</h4>
          <span className="chip ml-auto">read-only</span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {ll.map((n) => {
            const Icon = icon(n.icon);
            const t = TONES[n.tone];
            return (
              <li key={n.id} className="flex items-center gap-3 rounded-xl border border-line bg-ink-900/50 px-3 py-2">
                <span className="grid size-7 place-items-center rounded-lg" style={{ background: t.bg, color: t.fg }}>
                  <Icon size={14} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-fg">{title(n)}</span>
                  <span className="block truncate font-mono text-[0.68rem] text-fg-subtle">{n.at[mode]?.subtitle ?? n.subtitle}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {out.length > 0 && (
          <>
            <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-amber-800">Alerts & telemetry (configured destinations)</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {out.map((n) => (
                <span key={n.id} className="chip">
                  {title(n)}
                </span>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
