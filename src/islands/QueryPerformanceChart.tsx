import { useMemo, useState } from 'react';

// Illustrative workload: statements per type over one hour, as the Queries
// page classifies them from pg_stat_statements. Deterministic data.
// Colours: validated categorical slots 1–4 (dark surface #0d1528, worst CVD ΔE 8.4).
const SERIES = [
  { id: 'SELECT', color: '#3987e5' },
  { id: 'INSERT', color: '#d95926' },
  { id: 'UPDATE', color: '#199e70' },
  { id: 'DELETE', color: '#c98500' },
] as const;

type Metric = 'calls' | 'time';
const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'calls', label: 'Calls / s', unit: '/s' },
  { id: 'time', label: 'Mean time / call', unit: 'ms' },
];

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const N = 60;
const DATA = (() => {
  const r = rng(7);
  return Array.from({ length: N }, (_, i) => {
    const wave = Math.sin(i / 7) * 0.12;
    const deploy = i >= 38 ? 1 : 0; // a change at 14:38 doubles UPDATE time
    return {
      minute: i,
      calls: { SELECT: 820 * (1 + wave) + r() * 60, INSERT: 140 + r() * 18, UPDATE: 96 * (1 + wave) + r() * 12, DELETE: 18 + r() * 5 },
      time: { SELECT: 0.42 + r() * 0.08, INSERT: 0.9 + r() * 0.15, UPDATE: 1.4 + deploy * 1.6 + r() * 0.25, DELETE: 0.7 + r() * 0.12 },
    };
  });
})();

export default function QueryPerformanceChart() {
  const [metric, setMetric] = useState<Metric>('calls');
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const w = 560;
  const h = 260;
  const pad = { l: 44, r: 64, t: 14, b: 26 };
  const visible = SERIES.filter((s) => !hidden.has(s.id));

  const max = useMemo(() => {
    const vals = DATA.flatMap((d) => visible.map((s) => d[metric][s.id]));
    const m = Math.max(1, ...vals);
    const step = metric === 'calls' ? (m > 600 ? 250 : 50) : 1;
    return Math.ceil(m / step) * step;
  }, [metric, visible]);
  const ticks = metric === 'calls' ? [0, max / 2, max] : [0, max / 2, max];
  const x = (i: number) => pad.l + (i / (N - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => h - pad.b - (v / max) * (h - pad.t - pad.b);
  // Direct labels at line ends, nudged apart so they never overlap.
  const endLabels = (() => {
    const items = visible.map((s) => ({ id: s.id, y: y(DATA[N - 1][metric][s.id]) + 3.5 })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 12) items[i].y = items[i - 1].y + 12;
    const overflow = items.length ? items[items.length - 1].y - (h - pad.b + 4) : 0;
    if (overflow > 0) items.forEach((it) => (it.y -= overflow));
    return Object.fromEntries(items.map((it) => [it.id, it.y]));
  })();
  const fmt = (v: number) => (metric === 'calls' ? Math.round(v).toLocaleString('en-US') : v.toFixed(2));

  return (
    <div className="viz-root">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Metric" className="flex gap-1">
          {METRICS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={metric === m.id} className={`ctrl ${metric === m.id ? 'is-active' : ''}`} onClick={() => setMetric(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <ul className="ml-auto flex flex-wrap gap-1" aria-label="Legend: toggle series">
          {SERIES.map((s) => (
            <li key={s.id}>
              <button type="button" className="ctrl font-mono !text-[0.7rem]" aria-pressed={!hidden.has(s.id)} onClick={() => setHidden((hs) => { const n = new Set(hs); if (n.has(s.id)) n.delete(s.id); else if (n.size < SERIES.length - 1) n.add(s.id); return n; })}>
                <span className="size-2.5 rounded-sm" style={{ background: hidden.has(s.id) ? 'transparent' : s.color, border: `1.5px solid ${s.color}` }} aria-hidden />
                {s.id}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" role="img" aria-label={`Illustrative ${METRICS.find((m) => m.id === metric)!.label} by statement type over one hour. UPDATE time per call doubles after 14:38.`} onPointerLeave={() => setHover(null)} onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * w;
          const i = Math.round(((px - pad.l) / (w - pad.l - pad.r)) * (N - 1));
          setHover(i >= 0 && i < N ? i : null);
        }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(148,163,184,0.12)" />
              <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fill="#8796b0" fontSize={10}>{fmt(t)}</text>
            </g>
          ))}
          {[0, 15, 30, 45, 59].map((i) => (
            <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fill="#8796b0" fontSize={10}>{`14:${String(i).padStart(2, '0')}`}</text>
          ))}
          {metric === 'time' && (
            <g>
              <line x1={x(38)} x2={x(38)} y1={pad.t} y2={h - pad.b} stroke="#a78bfa" strokeDasharray="3 3" />
              <text x={x(38) + 5} y={pad.t + 10} fill="#c4b5fd" fontSize={10}>change: index dropped (example)</text>
            </g>
          )}
          {visible.map((s) => {
            const d = DATA.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[metric][s.id]).toFixed(1)}`).join(' ');
            return (
              <g key={s.id}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <text x={w - pad.r + 6} y={endLabels[s.id]} fill="#cbd5e1" fontSize={10} className="font-mono">{s.id}</text>
              </g>
            );
          })}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={h - pad.b} stroke="rgba(226,232,240,0.35)" />
              {visible.map((s) => (
                <circle key={s.id} cx={x(hover)} cy={y(DATA[hover][metric][s.id])} r={4} fill={s.color} stroke="#0d1528" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-lg border border-line-strong bg-ink-900/95 px-3 py-2 text-xs shadow-xl" style={{ left: `${(x(hover) / w) * 100}%`, transform: hover > N / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}>
            <p className="font-mono text-fg-subtle">14:{String(hover).padStart(2, '0')}</p>
            {visible.map((s) => (
              <p key={s.id} className="mt-1 flex items-center gap-2 text-fg-muted">
                <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                <span className="font-mono">{s.id}</span>
                <span className="ml-auto font-mono text-fg">{fmt(DATA[hover][metric][s.id])} {METRICS.find((m) => m.id === metric)!.unit}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <p className="mt-2 text-[0.72rem] text-fg-subtle">Illustrative data. LockLens derives these from pg_stat_statements deltas every 15 s: window means, not per-execution samples.</p>
    </div>
  );
}
