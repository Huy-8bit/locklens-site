import { useState } from 'react';

// Illustrative: one statement's mean time per call against its own baseline
// (median ± MAD for that hour of day, from five-minute rollups). After a
// change the statement becomes > 2× slower per call → queries.mean_regression.
const N = 48; // 5-minute buckets = 4 hours
const DATA = (() => {
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: N }, (_, i) => {
    const median = 3.1 + Math.sin(i / 9) * 0.35;
    const mad = 0.45;
    const regress = i >= 33 ? 2.35 : 1;
    return { i, median, lo: median - mad, hi: median + mad, value: median * regress + (r() - 0.5) * 0.6 };
  });
})();
const START = 33;
const label = (i: number) => {
  const m = 10 * 60 + i * 5;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export default function BaselineChart() {
  const [hover, setHover] = useState<number | null>(null);
  const w = 560;
  const h = 250;
  const pad = { l: 40, r: 16, t: 16, b: 26 };
  const max = 10;
  const x = (i: number) => pad.l + (i / (N - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => h - pad.b - (v / max) * (h - pad.t - pad.b);
  const band = DATA.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.hi).toFixed(1)}`).join(' ') + ' ' + [...DATA].reverse().map((d) => `L${x(d.i).toFixed(1)},${y(d.lo).toFixed(1)}`).join(' ') + ' Z';
  const median = DATA.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.median).toFixed(1)}`).join(' ');
  const line = DATA.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const hd = hover !== null ? DATA[hover] : null;
  return (
    <div className="viz-root">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] text-fg-muted" aria-label="Legend">
        <li className="flex items-center gap-2"><span className="h-0.5 w-4 rounded bg-[#3987e5]" aria-hidden /> mean time per call</li>
        <li className="flex items-center gap-2"><span className="h-2.5 w-4 rounded-sm bg-slate-400/20 ring-1 ring-slate-400/40" aria-hidden /> baseline: median ± MAD, same hour of day</li>
      </ul>
      <div className="relative mt-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" role="img" aria-label="Illustrative: a statement's mean time per call stays inside its baseline band until 12:45, then runs about 2.3 times slower; LockLens reports a queries.mean_regression finding." onPointerLeave={() => setHover(null)} onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * w;
          const i = Math.round(((px - pad.l) / (w - pad.l - pad.r)) * (N - 1));
          setHover(i >= 0 && i < N ? i : null);
        }}>
          {[0, 5, 10].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(148,163,184,0.12)" />
              <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fill="#8796b0" fontSize={10}>{t} ms</text>
            </g>
          ))}
          {[0, 12, 24, 36, 47].map((i) => (
            <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fill="#8796b0" fontSize={10}>{label(i)}</text>
          ))}
          <rect x={x(START) - 4} y={pad.t} width={x(N - 1) - x(START) + 8} height={h - pad.t - pad.b} fill="rgba(251,191,36,0.06)" />
          <path d={band} fill="rgba(148,163,184,0.16)" />
          <path d={median} fill="none" stroke="rgba(148,163,184,0.55)" strokeWidth={1} strokeDasharray="3 3" />
          <path d={line} fill="none" stroke="#3987e5" strokeWidth={2} strokeLinejoin="round" />
          <g transform={`translate(${x(START) + 6}, ${pad.t + 6})`}>
            <rect width={196} height={38} rx={8} fill="#0b1120" stroke="rgba(251,191,36,0.5)" />
            <path d="M12 10 L19 23 H5 Z" fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeLinejoin="round" />
            <text x={26} y={17} fill="#f1f5f9" fontSize={10.5} fontWeight={600}>queries.mean_regression</text>
            <text x={26} y={30} fill="#cbd5e1" fontSize={9.5}>2.3× slower per call · finding</text>
          </g>
          {hd && (
            <g>
              <line x1={x(hd.i)} x2={x(hd.i)} y1={pad.t} y2={h - pad.b} stroke="rgba(226,232,240,0.35)" />
              <circle cx={x(hd.i)} cy={y(hd.value)} r={4.5} fill="#3987e5" stroke="#0d1528" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hd && (
          <div className="pointer-events-none absolute top-14 z-10 rounded-lg border border-line-strong bg-ink-900/95 px-3 py-2 text-xs shadow-xl" style={{ left: `${(x(hd.i) / w) * 100}%`, transform: hd.i > N / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}>
            <p className="font-mono text-fg-subtle">{label(hd.i)}</p>
            <p className="mt-1 text-fg-muted">mean <span className="font-mono text-fg">{hd.value.toFixed(2)} ms</span></p>
            <p className="text-fg-muted">baseline <span className="font-mono text-fg">{hd.median.toFixed(2)} ± {(hd.hi - hd.median).toFixed(2)} ms</span></p>
            <p className="text-fg-muted">ratio <span className="font-mono text-fg">{(hd.value / hd.median).toFixed(1)}×</span></p>
          </div>
        )}
      </div>
      <p className="mt-2 text-[0.72rem] text-fg-subtle">Illustrative data. Until a statement has enough history, rules compare with the previous window only.</p>
    </div>
  );
}
