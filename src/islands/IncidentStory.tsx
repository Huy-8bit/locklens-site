import { useMemo, useRef } from 'react';
import { FlaskConical } from 'lucide-react';
import { SAMPLES, SCENES, SERVICE_LABELS, SERVICE_PIDS, type Scene, type ServiceId, type Session } from './data/incident';
import { route } from './diagram/geometry';
import { useInView, useReducedMotion, useStepper, useSvgAnimationControl } from './diagram/hooks';
import { DiagramDefs, DiagramEdge, DiagramNode } from './diagram/primitives';
import { icon } from './diagram/icons';
import { StepControls, StepTabs, siteUrl } from './diagram/ui';

const DEFS = 'is';
const W = 1400;
const H = 600;

const ROW_ORDER = [4120, 4133, 4139, 4142, 4131, 4127];
const ROW = { x: 700, w: 340, h: 60, y0: 98, gap: 78 };
const rowY = (pid: number) => ROW.y0 + ROW_ORDER.indexOf(pid) * ROW.gap;

const SERVICES: { id: ServiceId; y: number; icon: string }[] = [
  { id: 'checkout', y: 130, icon: 'ShoppingCart' },
  { id: 'inventory', y: 262, icon: 'Package' },
  { id: 'reporting', y: 394, icon: 'Receipt' },
  { id: 'batch', y: 510, icon: 'Repeat' },
];
const SVC_X = 420;
const SVC_W = 200;

const STATE_STYLE: Record<Session['state'], { fill: string; stroke: string; text: string; label: string }> = {
  active: { fill: 'rgba(52,211,153,0.12)', stroke: 'rgba(52,211,153,0.45)', text: '#6ee7b7', label: 'active' },
  idle: { fill: 'rgba(148,163,184,0.08)', stroke: 'rgba(148,163,184,0.3)', text: '#94a3b8', label: 'idle' },
  waiting: { fill: 'rgba(251,146,60,0.14)', stroke: 'rgba(251,146,60,0.6)', text: '#fdba74', label: 'waiting' },
};

function isRoot(scene: Scene, pid: number) {
  return scene.sessions.some((s) => s.blockedBy === pid) && !scene.sessions.find((s) => s.pid === pid)?.blockedBy;
}

export default function IncidentStory() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(wrapRef);
  const reduced = useReducedMotion();
  const stepper = useStepper(SCENES.length, 6500, { active: inView });
  const animate = inView && !reduced;
  useSvgAnimationControl(svgRef, animate);

  const sceneIndex = Math.max(0, stepper.step);
  const scene = SCENES[sceneIndex];
  const started = stepper.step >= 0;
  const burst = scene.sampling.startsWith('burst');

  const gwRect = { x: 214, y: 262, w: 170, h: 54 };
  const clientRect = { x: 24, y: 262, w: 160, h: 54 };
  const llRect = { x: 1116, y: 56, w: 264, h: 58 };
  const dbRect = { x: 680, y: 40, w: 380, h: 540 };

  const routes = useMemo(() => {
    const r: Record<string, ReturnType<typeof route>> = {
      'c-gw': route(clientRect, gwRect),
      'db-ll': route({ x: dbRect.x, y: 60, w: dbRect.w, h: 56 }, llRect, { from: 'r', to: 'l' }),
    };
    for (const s of SERVICES) if (s.id !== 'batch') r[`gw-${s.id}`] = route(gwRect, { x: SVC_X, y: s.y, w: SVC_W, h: 54 });
    for (const s of SERVICES)
      for (const pid of SERVICE_PIDS[s.id]) r[`${s.id}-${pid}`] = route({ x: SVC_X, y: s.y, w: SVC_W, h: 54 }, { x: ROW.x, y: rowY(pid), w: ROW.w, h: ROW.h }, { from: 'r', to: 'l' });
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const svcTone = (id: ServiceId) => (scene.services[id].status === 'ok' ? 'slate' : scene.services[id].status === 'slow' ? 'amber' : 'orange');

  return (
    <div ref={wrapRef} className="is-root">
      <div className="flex flex-col gap-3">
        <StepTabs steps={SCENES.map((s) => ({ id: s.id, title: s.title }))} stepper={stepper} overviewLabel="Before" />
        <StepControls stepper={stepper} labels={{ play: 'Start incident' }} />
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-fg-subtle">
        <FlaskConical size={13} aria-hidden className="text-accent" />
        Illustrative simulation with deterministic data — no connection to any database. Service latency is shown only as the consequence of database blocking; LockLens does not measure it.
      </p>

      {/* Desktop system view */}
      <div className="panel mt-3 hidden overflow-hidden lg:block">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className={`diagram-svg block h-auto w-full ${animate ? '' : 'dg-paused'}`} style={{ touchAction: 'pan-y' }} role="img" aria-label={`Simulation at ${scene.time}: ${scene.title}. ${scene.narration}`}>
          <DiagramDefs id={DEFS} />
          <rect width={W} height={H} fill={`url(#${DEFS}-grid)`} />

          {/* Application side */}
          <text x={24} y={30} fill="#7d8aa5" fontSize={11} fontWeight={650} letterSpacing="0.1em">ILLUSTRATIVE APPLICATION</text>
          <DiagramEdge defsId={DEFS} route={routes['c-gw']} kind="app" state={started ? 'active' : 'normal'} animate={animate} particles={2} speed={2.2} />
          {SERVICES.filter((s) => s.id !== 'batch').map((s) => (
            <DiagramEdge key={s.id} defsId={DEFS} route={routes[`gw-${s.id}`]} kind="app" state={started && scene.services[s.id].status === 'ok' ? 'active' : 'normal'} animate={animate} particles={1} speed={2.4} />
          ))}
          {SERVICES.flatMap((s) =>
            SERVICE_PIDS[s.id].map((pid) => {
              const sess = scene.sessions.find((x) => x.pid === pid)!;
              const r = routes[`${s.id}-${pid}`];
              const waiting = sess.state === 'waiting';
              const idle = sess.state === 'idle';
              return (
                <g key={`${s.id}-${pid}`} style={{ opacity: idle ? 0.25 : 1, transition: 'opacity 500ms' }}>
                  <path d={r.d} fill="none" stroke={waiting ? '#fb923c' : '#94a3b8'} strokeWidth={waiting ? 2 : 1.4} strokeOpacity={waiting ? 0.9 : 0.55} strokeDasharray={waiting ? '3 5' : undefined} style={{ transition: 'stroke 500ms' }} />
                  {started && !idle && !waiting && animate && (
                    <circle r={2.6} fill="#cbd5e1">
                      <animateMotion dur="1.8s" repeatCount="indefinite" path={r.d} />
                    </circle>
                  )}
                </g>
              );
            }),
          )}
          <DiagramNode id="clients" defsId={DEFS} rect={clientRect} title="Clients" subtitle="web · mobile" icon={icon('Globe')} tone="slate" compact />
          <DiagramNode id="gw" defsId={DEFS} rect={gwRect} title="API gateway" subtitle="example" icon={icon('Router')} tone="slate" compact />
          {SERVICES.map((s) => {
            const st = scene.services[s.id];
            return (
              <DiagramNode
                key={s.id}
                id={s.id}
                defsId={DEFS}
                rect={{ x: SVC_X, y: s.y, w: SVC_W, h: 54 }}
                title={SERVICE_LABELS[s.id]}
                subtitle={s.id === 'batch' ? `scheduled · ${st.latency}` : `p95 ${st.latency} · illustr.`}
                icon={icon(s.icon)}
                tone={svcTone(s.id)}
                state={st.status === 'ok' ? 'normal' : 'active'}
                compact
              />
            );
          })}

          {/* PostgreSQL */}
          <rect x={dbRect.x} y={dbRect.y} width={dbRect.w} height={dbRect.h} rx={18} fill="rgba(15,23,42,0.55)" stroke="rgba(34,211,238,0.35)" />
          <text x={dbRect.x + 20} y={dbRect.y + 26} fill="#67e8f9" fontSize={11.5} fontWeight={650} letterSpacing="0.08em">ORDERS-DB · POSTGRESQL PRIMARY</text>
          <text x={dbRect.x + 20} y={dbRect.y + 44} fill="#7d8aa5" fontSize={10.5}>client sessions as pg_stat_activity shows them</text>
          {ROW_ORDER.map((pid) => {
            const s = scene.sessions.find((x) => x.pid === pid)!;
            const y = rowY(pid);
            const st = STATE_STYLE[s.state];
            const root = started && isRoot(scene, pid);
            const pill = root ? 'root blocker' : st.label;
            const pw = pill.length * 6.1 + 18;
            return (
              <g key={pid} transform={`translate(${ROW.x}, ${y})`}>
                <rect width={ROW.w} height={ROW.h} rx={10} fill={root ? 'rgba(251,113,133,0.12)' : '#0d1528'} stroke={root ? '#fb7185' : st.stroke} strokeWidth={root ? 1.6 : 1} style={{ transition: 'all 500ms' }} />
                {root && <rect x={-3} y={-3} width={ROW.w + 6} height={ROW.h + 6} rx={13} fill="none" stroke="#fb7185" strokeOpacity={0.5} strokeWidth={5} filter={`url(#${DEFS}-glow)`} className="dg-pulse" />}
                <text x={14} y={23} fill="#f1f5f9" fontSize={12.5} fontWeight={650} className="mono">pid {pid}</text>
                <text x={90} y={23} fill="#9aa8c1" fontSize={11}>{s.app}</text>
                <g transform={`translate(${ROW.w - 12}, 10)`}>
                  <rect x={-pw} width={pw} height={18} rx={9} fill={root ? 'rgba(251,113,133,0.18)' : st.fill} stroke={root ? '#fb7185' : st.stroke} style={{ transition: 'all 500ms' }} />
                  <text x={-pw / 2} y={12.5} textAnchor="middle" fill={root ? '#fda4af' : st.text} fontSize={10} fontWeight={600}>{pill}</text>
                </g>
                <text x={14} y={44} fill="#7d8aa5" fontSize={10} className="mono">{truncate(s.query, 38)}</text>
                <text x={ROW.w - 12} y={44} textAnchor="end" fill={s.state === 'waiting' ? '#fdba74' : '#8796b0'} fontSize={10} className="mono">{s.detail}</text>
              </g>
            );
          })}
          {/* Lock-wait arcs: waiter → blocker (only pg_blocking_pids() edges) */}
          {scene.sessions
            .filter((s) => s.blockedBy)
            .map((s) => {
              const y1 = rowY(s.pid) + ROW.h / 2;
              const y2 = rowY(s.blockedBy!) + ROW.h / 2;
              const x = ROW.x + ROW.w;
              const bulge = 22 + Math.abs(y2 - y1) * 0.05;
              return (
                <g key={`w-${s.pid}`}>
                  <path d={`M${x},${y1} C${x + bulge},${y1} ${x + bulge},${y2} ${x + 2},${y2}`} fill="none" stroke="#fb923c" strokeWidth={1.8} strokeDasharray="4 3" className="dg-flow-dash" markerEnd={`url(#${DEFS}-arrow-alert)`} />
                </g>
              );
            })}

          {/* LockLens */}
          <text x={1116} y={30} fill="#67e8f9" fontSize={11} fontWeight={650} letterSpacing="0.1em">LOCKLENS · OUT OF BAND</text>
          <DiagramEdge defsId={DEFS} route={routes['db-ll']} kind="collect" state={started ? 'active' : 'normal'} animate={animate} speed={burst ? 0.9 : 2.2} particles={burst ? 3 : 1} />
          <DiagramNode id="ll" defsId={DEFS} rect={llRect} title="locklens server" subtitle={scene.sampling} icon={icon('Radar')} tone="cyan" state={started && scene.incident?.state === 'open' ? 'active' : 'normal'} compact />
          <g transform="translate(1116, 136)">
            <rect width={264} height={248} rx={14} fill="#0b1222" stroke="rgba(148,163,184,0.22)" />
            <text x={14} y={24} fill="#e2e8f0" fontSize={12} fontWeight={600}>Blocking graph</text>
            <text x={14} y={40} fill="#7d8aa5" fontSize={10} className="mono">edges from pg_blocking_pids()</text>
            <g transform="translate(14, 58)">
              <BlockingTreeSvg scene={scene} started={started} />
            </g>
          </g>
          <g transform="translate(1116, 400)">
            <IncidentCardSvg scene={scene} started={started} />
          </g>
        </svg>
      </div>

      {/* Phones: sessions list */}
      <div className="mt-3 space-y-2 lg:hidden">
        <div className="panel p-3">
          <p className="px-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent">orders-db · sessions</p>
          <ul className="mt-2 space-y-1.5">
            {ROW_ORDER.map((pid) => {
              const s = scene.sessions.find((x) => x.pid === pid)!;
              const st = STATE_STYLE[s.state];
              const root = started && isRoot(scene, pid);
              return (
                <li key={pid} className="rounded-lg border px-3 py-2" style={{ borderColor: root ? '#fb7185' : st.stroke, background: root ? 'rgba(251,113,133,0.08)' : undefined }}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono font-semibold text-fg">{pid}</span>
                    <span className="text-xs text-fg-muted">{s.app}</span>
                    <span className="ml-auto rounded-full px-2 text-[0.68rem]" style={{ color: root ? '#fda4af' : st.text, background: root ? 'rgba(251,113,133,0.15)' : st.fill }}>
                      {root ? 'root blocker' : st.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[0.68rem] text-fg-subtle">{s.query}</p>
                  <p className="font-mono text-[0.68rem]" style={{ color: s.blockedBy ? '#fdba74' : '#8796b0' }}>
                    {s.detail}
                    {s.blockedBy ? ` · blocked by ${s.blockedBy}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="panel p-3">
          <p className="px-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Blocking graph (LockLens)</p>
          <svg viewBox="0 0 240 150" className="mt-2 w-full max-w-[320px]" role="img" aria-label="Blocking graph">
            <BlockingTreeSvg scene={scene} started={started} />
          </svg>
        </div>
      </div>

      {/* Narration, chart, timeline */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel p-5" aria-live="polite">
          <p className="eyebrow">{started ? `Scene ${sceneIndex + 1} of ${SCENES.length} · ${scene.time}` : 'Ready'}</p>
          <h3 className="mt-1.5 text-lg font-semibold text-fg">{started ? scene.title : 'What happens when PostgreSQL becomes a bottleneck?'}</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{started ? scene.narration : 'Press Start incident to follow one transaction holding row locks for too long, the sessions that queue behind it, and the evidence LockLens records. Step through at your own pace.'}</p>
          {started && (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg border border-accent/25 bg-accent/[0.05] p-3">
                <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-accent">What LockLens observes</dt>
                <dd className="mt-1 leading-relaxed text-cyan-50/85">{scene.sees}</dd>
              </div>
              <div className="rounded-lg border border-line p-3">
                <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Illustrative consequence</dt>
                <dd className="mt-1 leading-relaxed text-fg-muted">{scene.consequence}</dd>
              </div>
            </dl>
          )}
        </div>
        <div className="panel p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Activity samples</p>
          <h4 className="mt-1 text-sm font-medium text-fg">Blocked sessions and longest lock wait</h4>
          <SampleChart upto={started ? scene.sampleIndex : SCENES[0].sampleIndex} />
          <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
            Each dot is one activity collection: every 10 s, then every 3 s while sessions are blocked (adaptive sampling). Blocking shorter than the interval can be missed.
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Incident timeline</p>
          {scene.incident && started ? (
            <>
              <h4 className="mt-1 text-sm font-medium text-fg">
                #{scene.incident.id} · {scene.incident.state === 'open' ? 'open' : 'resolved'} · lasted {scene.incident.duration}
              </h4>
              <ol className="mt-3 space-y-2 border-l border-line pl-4">
                {scene.timeline.map((e, i) => (
                  <li key={i} className="relative text-[0.8rem] leading-snug">
                    <span className={`absolute -left-[21px] top-1 size-2 rounded-full ${e.kind === 'trigger' ? 'bg-blocker' : e.kind === 'resolved' ? 'bg-ok' : 'bg-accent/70'}`} aria-hidden />
                    <span className="font-mono text-[0.7rem] text-fg-subtle">{e.time} · {e.kind}</span>
                    <span className="block text-fg-muted">{e.text}</span>
                  </li>
                ))}
              </ol>
              {scene.hypotheses && (
                <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/[0.05] p-3">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-amber-200/90">Possible explanations — not confirmed</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[0.8rem] text-fg-muted">
                    {scene.hypotheses.map((h) => <li key={h}>{h}</li>)}
                  </ul>
                  <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Next checks</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-[0.8rem] text-fg-muted">
                    {scene.nextChecks?.map((h) => <li key={h}>{h}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              {started ? 'No incident yet. A finding needs the same root blocker to persist for at least 30 s across at least 3 consecutive samples.' : 'No incident.'}
            </p>
          )}
          <a href={siteUrl('/docs/features/incidents/')} className="mt-4 inline-block text-xs text-accent hover:underline">How incidents are recorded →</a>
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/* Blocking tree drawn from blockedBy relations (roots first, depth-first). */
function BlockingTreeSvg({ scene, started }: { scene: Scene; started: boolean }) {
  const rows: { s: Session; depth: number }[] = [];
  if (started) {
    const children = (pid: number) => scene.sessions.filter((x) => x.blockedBy === pid);
    const walk = (s: Session, depth: number) => {
      rows.push({ s, depth });
      children(s.pid).forEach((c) => walk(c, depth + 1));
    };
    scene.sessions.filter((s) => isRoot(scene, s.pid)).forEach((r) => walk(r, 0));
  }
  if (!rows.length)
    return (
      <text x={0} y={20} fill="#6b7a96" fontSize={11}>
        {started && scene.id === 'recovery' ? 'No blocking. Waiters acquired their locks.' : 'No blocking edges.'}
      </text>
    );
  const total = rows.length - 1;
  return (
    <g>
      {rows.map(({ s, depth }, i) => {
        const y = i * 34;
        const x = depth * 26;
        const root = depth === 0;
        const parentIndex = rows.findIndex((r) => r.s.pid === s.blockedBy);
        return (
          <g key={s.pid} style={{ transition: 'opacity 400ms' }}>
            {parentIndex >= 0 && <path d={`M${x - 16},${parentIndex * 34 + 24} V${y + 12} H${x - 2}`} fill="none" stroke="#fb923c" strokeOpacity={0.7} strokeWidth={1.4} />}
            <rect x={x} y={y} width={root ? 220 : 200 - depth * 6} height={24} rx={7} fill={root ? 'rgba(251,113,133,0.15)' : 'rgba(251,146,60,0.1)'} stroke={root ? '#fb7185' : 'rgba(251,146,60,0.5)'} />
            <text x={x + 9} y={y + 16} fill="#f1f5f9" fontSize={11} fontWeight={600} className="mono">{s.pid}</text>
            <text x={x + 48} y={y + 16} fill={root ? '#fda4af' : '#fdba74'} fontSize={10}>
              {root ? `root · blocks ${total} in total` : `${s.app} · ${s.detail.replace('Lock · ', 'waits ')}`}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function IncidentCardSvg({ scene, started }: { scene: Scene; started: boolean }) {
  const inc = started ? scene.incident : null;
  const open = inc?.state === 'open';
  return (
    <g>
      <rect width={264} height={176} rx={14} fill={open ? 'rgba(251,113,133,0.07)' : '#0b1222'} stroke={open ? 'rgba(251,113,133,0.55)' : inc ? 'rgba(52,211,153,0.45)' : 'rgba(148,163,184,0.22)'} style={{ transition: 'all 500ms' }} />
      <text x={14} y={24} fill="#e2e8f0" fontSize={12} fontWeight={600}>Incident</text>
      {inc ? (
        <>
          <text x={250} y={24} textAnchor="end" fill={open ? '#fda4af' : '#6ee7b7'} fontSize={10.5} fontWeight={650}>{open ? 'OPEN · warning' : 'RESOLVED'}</text>
          <text x={14} y={50} fill="#f1f5f9" fontSize={11.5} fontWeight={600}>#{inc.id} Blocking chain rooted at</text>
          <text x={14} y={66} fill="#f1f5f9" fontSize={11.5} fontWeight={600}>pid 4127 persists (3 blocked)</text>
          <text x={14} y={92} fill="#8796b0" fontSize={10.5} className="mono">rule blocking.long_chain v1</text>
          <text x={14} y={110} fill="#8796b0" fontSize={10.5} className="mono">opened {inc.opened} · {inc.duration}</text>
          <text x={14} y={128} fill="#8796b0" fontSize={10.5} className="mono">{scene.timeline.length} events recorded</text>
          <text x={14} y={156} fill={open ? '#fcd34d' : '#6ee7b7'} fontSize={10.5}>{open ? '→ notification: opened (if a channel matches)' : '→ evidence kept · export JSON / HTML'}</text>
        </>
      ) : (
        <text x={14} y={52} fill="#6b7a96" fontSize={11}>No open incident</text>
      )}
    </g>
  );
}

function SampleChart({ upto }: { upto: number }) {
  // Two panels sharing the time axis (never a dual-axis chart).
  const w = 320;
  const ph = 66;
  const pad = { l: 34, r: 10 };
  const t0 = SAMPLES[0].t;
  const t1 = SAMPLES[SAMPLES.length - 1].t;
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (w - pad.l - pad.r);
  const pts = SAMPLES.slice(0, upto + 1);
  const last = pts[pts.length - 1];
  const panels = [
    { key: 'blocked', title: 'Blocked sessions', color: '#fb923c', max: 4, ticks: [0, 2, 4], fmt: (v: number) => String(v), val: (p: (typeof SAMPLES)[number]) => p.blocked, stepped: true },
    { key: 'wait', title: 'Longest lock wait', color: '#a78bfa', max: 120, ticks: [0, 60, 120], fmt: (v: number) => `${v}s`, val: (p: (typeof SAMPLES)[number]) => p.maxWait, stepped: false },
  ];
  return (
    <svg viewBox={`0 0 ${w} ${ph * 2 + 78}`} className="mt-3 w-full" role="img" aria-label={`Up to ${last.label}: ${last.blocked} blocked sessions; longest lock wait ${last.maxWait} seconds.`}>
      {panels.map((pn, k) => {
        const top = 16 + k * (ph + 36);
        const y = (v: number) => top + ph - (v / pn.max) * ph;
        const d = pts
          .map((p, i) => {
            const v = pn.val(p);
            if (!i) return `M${x(p.t).toFixed(1)},${y(v).toFixed(1)}`;
            return pn.stepped ? `L${x(p.t).toFixed(1)},${y(pn.val(pts[i - 1])).toFixed(1)} L${x(p.t).toFixed(1)},${y(v).toFixed(1)}` : `L${x(p.t).toFixed(1)},${y(v).toFixed(1)}`;
          })
          .join(' ');
        return (
          <g key={pn.key}>
            <text x={pad.l} y={top - 4} fill="#cbd5e1" fontSize={9.5} fontWeight={600}>{pn.title}</text>
            <text x={w - pad.r} y={top - 4} textAnchor="end" fill="#cbd5e1" fontSize={9.5} className="mono">{pn.fmt(pn.val(last))}</text>
            {pn.ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(148,163,184,0.12)" />
                <text x={pad.l - 5} y={y(t) + 3} textAnchor="end" fill="#6b7a96" fontSize={8.5}>{pn.fmt(t)}</text>
              </g>
            ))}
            <path d={d} fill="none" stroke={pn.color} strokeWidth={2} strokeLinejoin="round" />
            {pn.key === 'blocked' && pts.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.blocked)} r={1.7} fill={p.blocked ? '#fb923c' : '#64748b'} />)}
            <line x1={x(last.t)} x2={x(last.t)} y1={top} y2={top + ph} stroke="#22d3ee" strokeOpacity={0.5} />
          </g>
        );
      })}
      {['14:01:20', '14:02:40', '14:04:04'].map((l, i) => {
        const s = SAMPLES.find((p) => p.label === l)!;
        return <text key={l} x={x(s.t)} y={ph * 2 + 74} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fill="#6b7a96" fontSize={9}>{l}</text>;
      })}
    </svg>
  );
}
