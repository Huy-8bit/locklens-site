import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useInView, useReducedMotion, useSvgAnimationControl } from './diagram/hooks';

// Storyboard (one loop ≈ 17 s). Each phase is a fully determined visual state.
const PHASES = [
  { ms: 2600, caption: 'Application queries run normally' },
  { ms: 2200, caption: 'pid 4127 updates rows and keeps its transaction open' },
  { ms: 2600, caption: 'Other sessions wait for its row locks' },
  { ms: 2200, caption: 'LockLens observes PostgreSQL out of band' },
  { ms: 3000, caption: 'Blocking graph: root blocker pid 4127, 3 sessions waiting' },
  { ms: 4200, caption: 'The incident keeps the evidence for investigation' },
] as const;

type Sess = { id: string; pid: number; x: number; y: number; lane: number };
const SESSIONS: Sess[] = [
  { id: 'a', pid: 4127, x: 252, y: 150, lane: 0 },
  { id: 'b', pid: 4133, x: 392, y: 150, lane: 0 },
  { id: 'c', pid: 4139, x: 392, y: 245, lane: 1 },
  { id: 'd', pid: 4120, x: 252, y: 245, lane: 1 },
  { id: 'e', pid: 4142, x: 252, y: 340, lane: 2 },
  { id: 'f', pid: 4131, x: 392, y: 340, lane: 2 },
];
const WAITS: [string, string][] = [
  ['b', 'a'],
  ['c', 'b'],
  ['e', 'a'],
];
const LANES_Y = [150, 245, 340];

export default function HeroScene({ screenshot }: { screenshot: { src: string; width: number; height: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, '0px');
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const running = inView && !reduced && !paused;
  useSvgAnimationControl(svgRef, running);

  useEffect(() => {
    if (reduced) setPhase(4);
  }, [reduced]);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setPhase((p) => (p + 1) % PHASES.length), PHASES[phase].ms);
    return () => window.clearTimeout(t);
  }, [phase, running]);

  const holds = phase >= 1 && phase <= 5;
  const waiting = (id: string) => phase >= 2 && WAITS.some(([w]) => w === id);
  const observing = phase >= 3;
  const graph = phase >= 4;
  const shot = phase === 5;
  // Lanes whose requests reach waiting sessions slow down (illustrative).
  const laneBlocked = (lane: number) => phase >= 2 && lane !== 1;

  return (
    <div ref={ref} className="relative">
      <div className="relative overflow-hidden rounded-[20px] border border-line-strong bg-ink-900/70 shadow-2xl shadow-emerald-950/10 glow-ring">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-ink-600" />
          <span className="size-2.5 rounded-full bg-ink-600" />
          <span className="size-2.5 rounded-full bg-ink-600" />
          <span className="ml-3 font-mono text-[0.7rem] text-fg-subtle">orders-db · live view</span>
          <span className="ml-auto chip !py-0 text-[0.65rem]">illustrative</span>
        </div>
        <div className="relative">
          <svg ref={svgRef} viewBox="0 0 640 470" className={`block h-auto w-full ${running ? '' : 'dg-paused'}`} role="img" aria-label={`Animation: ${PHASES[phase].caption}.`}>
            <defs>
              <pattern id="hero-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M20 0H0V20" fill="none" stroke="rgba(148,163,184,0.07)" />
              </pattern>
              <radialGradient id="hero-sweep" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="rgba(8,127,91,0.28)" />
                <stop offset="1" stopColor="rgba(8,127,91,0)" />
              </radialGradient>
              <marker id="hero-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M1,1 L9,5 L1,9 z" fill="#c45b17" />
              </marker>
              <marker id="hero-arrow-c" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M1,1 L9,5 L1,9 z" fill="#087f5b" />
              </marker>
              <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            <rect width="640" height="470" fill="url(#hero-grid)" />

            {/* Application requests */}
            <text x={18} y={92} fill="#627570" fontSize={10} fontWeight={600} letterSpacing="0.1em">APP REQUESTS</text>
            {LANES_Y.map((y, i) => {
              const d = `M18,${y} C110,${y} 140,${y} 196,${y}`;
              const blocked = laneBlocked(i);
              return (
                <g key={y}>
                  <path d={d} stroke={blocked ? '#c45b17' : '#73867f'} strokeOpacity={0.55} strokeWidth={1.5} fill="none" style={{ transition: 'stroke 600ms' }} />
                  {[0, 1, 2].map((k) => (
                    <circle key={k} r={3} fill={blocked ? '#a54b0e' : '#48615b'} style={{ transition: 'fill 600ms' }}>
                      <animateMotion dur={blocked ? '3.6s' : '1.5s'} begin={`${k * (blocked ? 1.2 : 0.5)}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  ))}
                </g>
              );
            })}

            {/* PostgreSQL */}
            <rect x={196} y={74} width={262} height={326} rx={22} fill="rgba(246,249,244,0.85)" stroke="rgba(8,127,91,0.35)" />
            <text x={216} y={102} fill="#087f5b" fontSize={11} fontWeight={650} letterSpacing="0.08em">POSTGRESQL</text>
            <text x={216} y={118} fill="#627570" fontSize={10}>client sessions</text>
            {observing && <circle cx={327} cy={240} r={170} fill="url(#hero-sweep)" className="dg-pulse" style={{ opacity: graph ? 0.35 : 0.8 }} />}

            {WAITS.map(([w, h]) => {
              const a = SESSIONS.find((s) => s.id === w)!;
              const b = SESSIONS.find((s) => s.id === h)!;
              const on = phase >= 2;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.hypot(dx, dy);
              const ux = dx / len;
              const uy = dy / len;
              const x1 = a.x + ux * 26;
              const y1 = a.y + uy * 26;
              const x2 = b.x - ux * 28;
              const y2 = b.y - uy * 28;
              const bend = w === 'e' ? -60 : 0;
              const d = bend ? `M${x1},${y1} Q${a.x + bend},${(a.y + b.y) / 2} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`;
              return <path key={w} d={d} fill="none" stroke="#c45b17" strokeWidth={2} strokeDasharray="4 4" markerEnd="url(#hero-arrow)" className="dg-flow-dash" style={{ opacity: on ? 1 : 0, transition: 'opacity 600ms' }} />;
            })}

            {SESSIONS.map((s) => {
              const root = s.id === 'a' && holds;
              const wait = waiting(s.id);
              const color = root ? '#cb4560' : wait ? '#c45b17' : '#14865d';
              return (
                <g key={s.id}>
                  {(root && graph) && <circle cx={s.x} cy={s.y} r={30} fill="#cb4560" opacity={0.45} filter="url(#hero-glow)" className="dg-pulse" />}
                  <circle cx={s.x} cy={s.y} r={22} fill="#ffffff" stroke={color} strokeWidth={root ? 2.4 : 1.6} style={{ transition: 'stroke 500ms' }} />
                  <circle cx={s.x} cy={s.y} r={6} fill={color} style={{ transition: 'fill 500ms' }}>
                    {!wait && !root && <animate attributeName="opacity" values="1;0.35;1" dur={`${1.1 + (s.pid % 5) * 0.2}s`} repeatCount="indefinite" />}
                  </circle>
                  <text x={s.x} y={s.y + 38} textAnchor="middle" fill="#48615b" fontSize={10.5} fontWeight={600} fontFamily="var(--font-mono)">{s.pid}</text>
                  {root && (
                    <g transform={`translate(${s.x + 28}, ${s.y - 10})`} style={{ opacity: holds ? 1 : 0, transition: 'opacity 500ms' }}>
                      <rect x={-3} y={-2} width={24} height={20} rx={6} fill="rgba(251,113,133,0.18)" stroke="#cb4560" />
                      <path d="M5 7V5a4 4 0 0 1 8 0v2M4 7h10v8H4z" fill="none" stroke="#b63850" strokeWidth={1.6} strokeLinejoin="round" />
                    </g>
                  )}
                </g>
              );
            })}

            {/* LockLens: out of band */}
            <path d="M458,300 C520,300 560,330 560,384" fill="none" stroke="#087f5b" strokeWidth={1.8} strokeDasharray="6 5" markerEnd="url(#hero-arrow-c)" style={{ opacity: observing ? 1 : 0.25, transition: 'opacity 600ms' }} className={observing ? 'dg-flow-dash' : ''} />
            {observing &&
              [0, 1].map((k) => (
                <circle key={k} r={3.2} fill="#087f5b">
                  <animateMotion dur="1.4s" begin={`${k * 0.7}s`} repeatCount="indefinite" path="M458,300 C520,300 560,330 560,384" />
                </circle>
              ))}
            <text x={494} y={288} fill="#087f5b" fontSize={9.5} style={{ opacity: observing ? 1 : 0, transition: 'opacity 600ms' }}>observing</text>
            <g transform="translate(494, 388)">
              <rect width={134} height={52} rx={14} fill="#ffffff" stroke={observing ? '#087f5b' : 'rgba(148,163,184,0.3)'} strokeWidth={observing ? 1.6 : 1} style={{ transition: 'stroke 500ms' }} />
              <g transform="translate(12, 13)">
                <rect width={26} height={26} rx={8} fill="rgba(8,127,91,0.12)" stroke="rgba(8,127,91,0.4)" />
                <circle cx={12} cy={12} r={5.5} fill="none" stroke="#087f5b" strokeWidth={1.6} />
                <path d="m16.2 16.2 3.6 3.6" stroke="#087f5b" strokeWidth={1.8} strokeLinecap="round" />
              </g>
              <text x={48} y={24} fill="#183b35" fontSize={12} fontWeight={650}>LockLens</text>
              <text x={48} y={39} fill="#627570" fontSize={9.5}>out of band</text>
            </g>

            {/* Blocking graph */}
            <g transform="translate(478, 92)" style={{ opacity: graph ? 1 : 0, transition: 'opacity 700ms' }}>
              <rect width={150} height={176} rx={14} fill="rgba(246,249,244,0.95)" stroke="rgba(251,113,133,0.45)" />
              <text x={12} y={22} fill="#24443e" fontSize={10.5} fontWeight={650}>Blocking graph</text>
              {[
                { pid: 4127, d: 0, y: 40, root: true },
                { pid: 4133, d: 1, y: 74 },
                { pid: 4139, d: 2, y: 108 },
                { pid: 4142, d: 1, y: 142 },
              ].map((n) => (
                <g key={n.pid}>
                  {n.d > 0 && <path d={`M${12 + (n.d - 1) * 20 + 8},${n.d === 2 ? 98 : 64} V${n.y + 11} H${12 + n.d * 20}`} fill="none" stroke="#c45b17" strokeOpacity={0.7} />}
                  <rect x={12 + n.d * 20} y={n.y} width={n.root ? 126 : 96} height={22} rx={6} fill={n.root ? 'rgba(251,113,133,0.18)' : 'rgba(251,146,60,0.12)'} stroke={n.root ? '#cb4560' : 'rgba(251,146,60,0.55)'} />
                  <text x={20 + n.d * 20} y={n.y + 15} fill="#102c2a" fontSize={10} fontWeight={600} fontFamily="var(--font-mono)">{n.pid}</text>
                  <text x={52 + n.d * 20} y={n.y + 15} fill={n.root ? '#b63850' : '#a54b0e'} fontSize={9}>{n.root ? 'root blocker' : 'waiting'}</text>
                </g>
              ))}
            </g>

            {/* Caption */}
            <g transform="translate(18, 432)">
              <rect width={460} height={26} rx={13} fill="rgba(235,242,234,0.85)" stroke="rgba(148,163,184,0.2)" />
              <circle cx={14} cy={13} r={3.5} fill={phase >= 2 && phase < 5 ? '#c45b17' : phase === 5 ? '#087f5b' : '#14865d'} />
              <text x={26} y={17} fill="#48615b" fontSize={11}>{PHASES[phase].caption}</text>
            </g>
          </svg>

          {/* Transition into the real product */}
          <div className="absolute inset-0 grid place-items-center bg-ink-950/70 p-5 backdrop-blur-[2px] transition-opacity duration-700" style={{ opacity: shot ? 1 : 0, pointerEvents: shot ? 'auto' : 'none' }} aria-hidden={!shot}>
            <figure className="w-full overflow-hidden rounded-xl border border-line-strong shadow-2xl shadow-emerald-950/10 transition-transform duration-700" style={{ transform: shot ? 'scale(1)' : 'scale(0.96)' }}>
              <img src={screenshot.src} width={screenshot.width} height={screenshot.height} alt="LockLens incident page: what happened, the root blocker, and who blocks whom" className="block h-auto w-full" loading="lazy" decoding="async" />
              <figcaption className="bg-ink-900 px-3 py-1.5 text-[0.7rem] text-fg-muted">Real LockLens incident page (lab screenshot)</figcaption>
            </figure>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="ctrl" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? 'Play hero animation' : 'Pause hero animation'} disabled={reduced}>
          {paused || reduced ? <Play size={13} aria-hidden /> : <Pause size={13} aria-hidden />}
          {paused ? 'Play' : 'Pause'}
        </button>
        <ol className="flex flex-1 gap-1.5" aria-hidden="true">
          {PHASES.map((p, i) => (
            <li key={p.caption} className="h-1 flex-1 overflow-hidden rounded-full bg-ink-700">
              <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: i <= phase ? '100%' : '0%' }} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
