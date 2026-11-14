import { useEffect, useMemo, useRef, useState } from 'react';
import { MousePointerClick } from 'lucide-react';
import { CANVAS, COLUMN_CAPTIONS, EDGES, GROUPS, NODES, STEPS, type ArchNode } from './data/internal';
import { route } from './diagram/geometry';
import { useInView, useReducedMotion, useStepper, useSvgAnimationControl, useZoomPan } from './diagram/hooks';
import { DiagramDefs, DiagramEdge, DiagramGroup, DiagramNode, Legend, TONES, type NodeState } from './diagram/primitives';
import { icon } from './diagram/icons';
import { DetailsPanel, StepControls, StepTabs, ZoomControls, siteUrl } from './diagram/ui';

const DEFS = 'ia';
const byId = new Map(NODES.map((n) => [n.id, n]));

interface Props {
  /** "preview" autoplays when visible and loops; "full" waits for the visitor. */
  variant?: 'full' | 'preview';
}

export default function InternalArchitecture({ variant = 'full' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(wrapRef);
  const reduced = useReducedMotion();
  const stepper = useStepper(STEPS.length, 5200, { active: inView });
  const zp = useZoomPan(svgRef, CANVAS.w, CANVAS.h);
  const [selected, setSelected] = useState<string | null>(null);
  const autoplayed = useRef(false);

  // Preview: start once when it first scrolls into view, loop at the end.
  useEffect(() => {
    if (variant !== 'preview' || reduced || !inView || autoplayed.current) return;
    autoplayed.current = true;
    stepper.play();
  }, [variant, reduced, inView, stepper]);
  useEffect(() => {
    if (variant !== 'preview' || reduced || stepper.playing || stepper.step !== STEPS.length - 1 || !autoplayed.current) return;
    const t = window.setTimeout(() => stepper.replay(), 6000);
    return () => window.clearTimeout(t);
  }, [variant, reduced, stepper]);

  const animate = !reduced && inView && (stepper.playing || selected !== null);
  useSvgAnimationControl(svgRef, animate);

  const routes = useMemo(
    () =>
      Object.fromEntries(
        EDGES.map((e) => {
          const a = byId.get(e.from)!;
          const b = byId.get(e.to)!;
          return [e.id, route(a.rect, b.rect, e.opts)];
        }),
      ),
    [],
  );

  const step = stepper.step;
  const current = step >= 0 ? STEPS[step] : null;

  const { nodeState, edgeState } = useMemo(() => {
    const ns = new Map<string, NodeState>();
    const es = new Map<string, 'normal' | 'active' | 'visited' | 'dim'>();
    if (current) {
      const visitedNodes = new Set(STEPS.slice(0, step).flatMap((s) => s.nodes));
      const visitedEdges = new Set(STEPS.slice(0, step).flatMap((s) => s.edges));
      for (const n of NODES) ns.set(n.id, current.nodes.includes(n.id) ? 'active' : visitedNodes.has(n.id) ? 'visited' : 'dim');
      for (const e of EDGES) es.set(e.id, current.edges.includes(e.id) ? 'active' : visitedEdges.has(e.id) ? 'visited' : 'dim');
    } else if (selected) {
      const linked = EDGES.filter((e) => e.from === selected || e.to === selected);
      const linkedNodes = new Set(linked.flatMap((e) => [e.from, e.to]));
      for (const n of NODES) ns.set(n.id, n.id === selected ? 'active' : linkedNodes.has(n.id) ? 'normal' : 'dim');
      for (const e of EDGES) es.set(e.id, linked.includes(e) ? 'active' : 'dim');
    }
    return { nodeState: ns, edgeState: es };
  }, [current, step, selected]);

  const onSelect = (id: string) => {
    if (zp.wasDragged()) return;
    stepper.goTo(-1);
    setSelected((s) => (s === id ? null : id));
  };
  const sel = selected ? byId.get(selected) : undefined;
  const activeGroups = new Set<string>(current ? current.nodes.map((id) => groupOf(id)) : []);

  return (
    <div ref={wrapRef} className="ia-root">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StepTabs steps={STEPS} stepper={stepper} />
        <div className="flex flex-wrap items-center gap-3">
          <StepControls stepper={stepper} labels={{ play: 'Play architecture flow' }} />
        </div>
      </div>

      {/* Desktop / tablet: interactive SVG canvas */}
      <div className="panel relative mt-4 hidden overflow-hidden lg:block">
        <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
          <p className="chip">
            <MousePointerClick size={12} aria-hidden /> Click a component for details · ⌘/Ctrl + scroll or buttons to zoom
          </p>
          <ZoomControls zp={zp} />
        </div>
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={zp.viewBox}
            className={`diagram-svg block h-auto w-full ${animate ? '' : 'dg-paused'}`}
            style={{ aspectRatio: `${CANVAS.w} / ${CANVAS.h}`, touchAction: zp.scale > 1 ? 'none' : 'pan-y', cursor: zp.scale > 1 ? 'grab' : 'default' }}
            role="group"
            aria-label="LockLens internal architecture diagram. Components are listed with their details below the controls."
            {...zp.bind}
          >
            <DiagramDefs id={DEFS} />
            <rect x={-2000} y={-2000} width={6000} height={6000} fill={`url(#${DEFS}-grid)`} />
            {GROUPS.map((g) => (
              <DiagramGroup key={g.id} id={DEFS} rect={g.rect} label={g.label} sublabel={g.sublabel} tone={g.tone} dashed={g.dashed} badge={g.badge} emphasis={activeGroups.has(g.id)} />
            ))}
            {COLUMN_CAPTIONS.map((c) => (
              <text key={c.text} x={c.x} y={c.y} fill="#627570" fontSize={10} fontWeight={600} letterSpacing="0.16em">
                {c.text}
              </text>
            ))}
            {EDGES.map((e) => {
              const st = edgeState.get(e.id) ?? 'normal';
              return <DiagramEdge key={e.id} defsId={DEFS} route={routes[e.id]} kind={e.kind} label={st === 'active' ? e.label : undefined} labelOffset={e.labelOffset} bidirectional={e.bidirectional} state={st} animate={animate} speed={e.kind === 'collect' ? 2 : 2.6} />;
            })}
            {NODES.map((n) => (
              <DiagramNode key={n.id} id={n.id} defsId={DEFS} rect={n.rect} title={n.title} subtitle={n.subtitle} icon={icon(n.icon)} tone={n.tone} badge={n.badge} state={nodeState.get(n.id) ?? 'normal'} selected={selected === n.id} onSelect={onSelect} />
            ))}
          </svg>

          {sel && (
            <aside className="absolute inset-y-3 right-3 z-20 w-[min(380px,46%)] overflow-y-auto rounded-2xl border border-line-strong bg-ink-900/95 p-5 shadow-2xl shadow-emerald-950/10 backdrop-blur-md" aria-label={`${sel.title} details`}>
              <DetailsPanel title={sel.title} subtitle={sel.subtitle} details={sel.details} onClose={() => setSelected(null)} />
            </aside>
          )}
        </div>
        <div className="grid gap-4 border-t border-line px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div aria-live="polite">
            <StepNarration step={step} />
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Legend kinds={['collect', 'process', 'store', 'api', 'alert']} className="lg:max-w-[520px] lg:justify-end" />
            {variant === 'preview' && (
              <a href={siteUrl('/architecture/')} className="btn btn-ghost btn-sm">
                Open the full architecture explorer →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Phones: guided, stacked view instead of a shrunken canvas */}
      <MobileGuide step={step} />
    </div>
  );
}

function groupOf(id: string) {
  if (id.startsWith('t-')) return 'g-target';
  if (id === 'node-exporter' || id === 'log-agent') return 'g-host';
  if (id === 'store') return 'g-store';
  if (id === 'ui' || id === 'frontend') return 'g-ui';
  if (['channels', 'alertmanager', 'prometheus'].includes(id)) return 'g-out';
  return 'g-server';
}

function StepNarration({ step, compact }: { step: number; compact?: boolean }) {
  if (step < 0) {
    return (
      <div>
        <p className="eyebrow">Overview</p>
        <h3 className="mt-1.5 text-lg font-semibold text-fg">One process, two images, one store</h3>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          The backend is a single Go process: collectors, rules, incident recorder and API are modules inside it, not separately deployed services. The frontend image serves the UI and proxies the API. LockLens keeps its history in its own PostgreSQL database.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">Press <strong className="text-fg">Play architecture flow</strong> to follow data from a target to an alert, or click any component.</p>
      </div>
    );
  }
  const s = STEPS[step];
  return (
    <div>
      <p className="eyebrow">
        Step {step + 1} of {STEPS.length}
      </p>
      <h3 className={`mt-2 font-semibold text-fg ${compact ? 'text-sm' : 'text-lg'}`}>{s.title}</h3>
      <p className={`mt-1 font-medium text-accent ${compact ? 'text-xs' : 'text-sm'}`}>{s.summary}</p>
      {!compact && <p className="mt-3 text-sm leading-relaxed text-fg-muted">{s.detail}</p>}
    </div>
  );
}

const MOBILE_GROUPS: { id: string; label: string; nodes: string[] }[] = [
  { id: 'g-target', label: 'Monitored PostgreSQL (read-only)', nodes: ['t-sessions', 't-statements', 't-counters', 't-replication', 't-catalog'] },
  { id: 'g-host', label: 'Database host (optional)', nodes: ['node-exporter', 'log-agent'] },
  { id: 'g-collect', label: 'locklens server · collect', nodes: ['registry', 'manager', 'collectors', 'deltas', 'live', 'writer'] },
  { id: 'g-analyse', label: 'locklens server · analyse', nodes: ['graph', 'rules', 'recorder', 'insight', 'optimizer', 'changes'] },
  { id: 'g-serve', label: 'locklens server · serve & deliver', nodes: ['api', 'auth', 'notifier', 'telemetry', 'cluster', 'jobs'] },
  { id: 'g-store', label: 'Monitoring store', nodes: ['store'] },
  { id: 'g-ui', label: 'Presentation', nodes: ['ui', 'frontend'] },
  { id: 'g-out', label: 'Alerts & integrations', nodes: ['channels', 'alertmanager', 'prometheus'] },
];

function MobileGuide({ step }: { step: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = step >= 0 ? STEPS[step] : null;
  return (
    <div className="mt-4 space-y-3 lg:hidden">
      <div className="panel p-4" aria-live="polite">
        <StepNarration step={step} />
      </div>
      {MOBILE_GROUPS.map((g) => {
        const nodes = g.nodes.map((id) => byId.get(id)!).filter(Boolean);
        const anyActive = current ? nodes.some((n) => current.nodes.includes(n.id)) : true;
        return (
          <section key={g.id} className={`panel p-3 transition-opacity duration-300 ${anyActive ? '' : 'opacity-40'}`} aria-label={g.label}>
            <h4 className="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{g.label}</h4>
            <ul className="mt-2 space-y-1.5">
              {nodes.map((n) => (
                <MobileNode key={n.id} n={n} active={current ? current.nodes.includes(n.id) : false} open={open === n.id} onToggle={() => setOpen((o) => (o === n.id ? null : n.id))} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MobileNode({ n, active, open, onToggle }: { n: ArchNode; active: boolean; open: boolean; onToggle: () => void }) {
  const Icon = icon(n.icon);
  const t = TONES[n.tone];
  return (
    <li className={`rounded-xl border transition-colors ${active ? 'border-accent/50 bg-accent/[0.06]' : 'border-line bg-ink-900/50'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: t.bg, color: t.fg }}>
          <Icon size={16} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-fg">{n.title}</span>
          {n.subtitle && <span className="block truncate font-mono text-[0.7rem] text-fg-subtle">{n.subtitle}</span>}
        </span>
        <span className="ml-auto text-fg-subtle" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-3 py-3">
          <DetailsPanel title={n.title} details={n.details} />
        </div>
      )}
    </li>
  );
}
