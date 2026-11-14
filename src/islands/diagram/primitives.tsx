import { memo, type ComponentType, type KeyboardEvent, type ReactNode, type SVGProps } from 'react';
import { FLOWS, type FlowKind } from './flows';
import type { Rect, Route } from './geometry';

export type NodeState = 'normal' | 'active' | 'visited' | 'dim' | 'hidden';
export type Tone = 'cyan' | 'blue' | 'violet' | 'emerald' | 'amber' | 'slate' | 'rose' | 'orange';

export const TONES: Record<Tone, { fg: string; bg: string; ring: string }> = {
  cyan: { fg: 'var(--diagram-cyan, #087a9e)', bg: 'rgba(8,127,91,0.12)', ring: '#087f5b' },
  blue: { fg: 'var(--diagram-blue, #346db6)', bg: 'rgba(96,165,250,0.13)', ring: '#2870b5' },
  violet: { fg: 'var(--diagram-violet, #7154af)', bg: 'rgba(167,139,250,0.14)', ring: '#7954b3' },
  emerald: { fg: 'var(--diagram-emerald, #147c77)', bg: 'rgba(52,211,153,0.13)', ring: '#14865d' },
  amber: { fg: 'var(--diagram-amber, #956608)', bg: 'rgba(251,191,36,0.13)', ring: '#aa7309' },
  slate: { fg: 'var(--diagram-slate, #566c88)', bg: 'rgba(148,163,184,0.12)', ring: '#73867f' },
  rose: { fg: 'var(--diagram-rose, #b63850)', bg: 'rgba(251,113,133,0.15)', ring: '#cb4560' },
  orange: { fg: 'var(--diagram-orange, #a54b0e)', bg: 'rgba(251,146,60,0.15)', ring: '#c45b17' },
};

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;

/* ------------------------------------------------------------------ */
/* Shared <defs>: arrowheads per flow kind, glow filter, node fill     */
/* ------------------------------------------------------------------ */

export function DiagramDefs({ id }: { id: string }) {
  return (
    <defs>
      {(Object.keys(FLOWS) as FlowKind[]).map((k) => (
        <marker key={k} id={`${id}-arrow-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M1,1.2 L8.8,5 L1,8.8 z" fill={FLOWS[k].color} />
        </marker>
      ))}
      <linearGradient id={`${id}-node`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--diagram-node, #fff)" />
        <stop offset="1" stopColor="var(--diagram-node, #fff)" />
      </linearGradient>
      <linearGradient id={`${id}-group`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--diagram-group, #f3f6fb)" />
        <stop offset="1" stopColor="var(--diagram-group, #f3f6fb)" />
      </linearGradient>
      <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M24 0H0V24" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
      </pattern>
    </defs>
  );
}

/* ------------------------------------------------------------------ */
/* Group boundary                                                     */
/* ------------------------------------------------------------------ */

export const DiagramGroup = memo(function DiagramGroup({
  id,
  rect,
  label,
  sublabel,
  tone = 'slate',
  dashed,
  opacity = 1,
  emphasis,
  badge,
}: {
  id: string;
  rect: Rect;
  label: string;
  sublabel?: string;
  tone?: Tone;
  dashed?: boolean;
  opacity?: number;
  emphasis?: boolean;
  badge?: string;
}) {
  const t = TONES[tone];
  return (
    <g className="dg-node" style={{ opacity }} aria-hidden="true">
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        rx={10}
        fill={`url(#${id}-group)`}
        stroke={emphasis ? t.ring : 'rgba(148,163,184,0.22)'}
        strokeOpacity={emphasis ? 0.55 : 1}
        strokeWidth={emphasis ? 1.4 : 1}
        strokeDasharray={dashed ? '5 5' : undefined}
        style={{ transition: 'stroke 300ms, stroke-opacity 300ms' }}
      />
      <text x={rect.x + 18} y={rect.y + 24} fill={t.fg} fontSize={11.5} fontWeight={650} letterSpacing="0.08em">
        {label.toUpperCase()}
      </text>
      {sublabel && (
        <text x={rect.x + 18} y={rect.y + 40} fill="var(--diagram-muted)" fontSize={10.5}>
          {sublabel}
        </text>
      )}
      {badge && (
        <g transform={`translate(${rect.x + rect.w - 16}, ${rect.y + 12})`}>
          <rect x={-(badge.length * 6.1 + 16)} y={0} width={badge.length * 6.1 + 16} height={18} rx={9} fill={t.bg} stroke={t.ring} strokeOpacity={0.4} />
          <text x={-(badge.length * 6.1 + 16) / 2} y={12.5} textAnchor="middle" fill={t.fg} fontSize={10} fontWeight={600}>
            {badge}
          </text>
        </g>
      )}
    </g>
  );
});

/* ------------------------------------------------------------------ */
/* Node                                                               */
/* ------------------------------------------------------------------ */

export interface DiagramNodeProps {
  id: string;
  defsId: string;
  rect: Rect;
  title: string;
  subtitle?: string;
  icon?: Icon;
  tone?: Tone;
  state?: NodeState;
  selected?: boolean;
  badge?: string;
  status?: 'ok' | 'wait' | 'blocker' | 'down' | null;
  onSelect?: (id: string) => void;
  opacityOverride?: number;
  compact?: boolean;
  children?: ReactNode;
}

const STATUS_COLOR = { ok: '#14865d', wait: '#c45b17', blocker: '#cb4560', down: '#64748b' } as const;

export const DiagramNode = memo(function DiagramNode({
  id,
  defsId,
  rect,
  title,
  subtitle,
  icon: IconCmp,
  tone = 'slate',
  state = 'normal',
  selected,
  badge,
  status,
  onSelect,
  opacityOverride,
  compact,
  children,
}: DiagramNodeProps) {
  const t = TONES[tone];
  const opacity = opacityOverride ?? (state === 'hidden' ? 0 : state === 'dim' ? 0.28 : 1);
  const active = state === 'active' || selected;
  const iconSize = compact ? 26 : 30;
  const clickable = Boolean(onSelect);
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(id);
    }
  };
  return (
    <g
      className="dg-node"
      data-node={id}
      data-state={state}
      data-clickable={clickable}
      transform={`translate(${rect.x}, ${rect.y})`}
      style={{ opacity, pointerEvents: opacity < 0.05 ? 'none' : undefined }}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable && opacity > 0.05 ? 0 : undefined}
      aria-label={clickable ? `${title}${subtitle ? ` — ${subtitle}` : ''}. Show details` : undefined}
      aria-pressed={clickable ? Boolean(selected) : undefined}
      onClick={clickable ? () => onSelect?.(id) : undefined}
      onKeyDown={clickable ? onKey : undefined}
    >
      {active && <rect x={-3} y={-3} width={rect.w + 6} height={rect.h + 6} rx={11} fill="none" stroke={t.ring} strokeOpacity={0.16} strokeWidth={2} />}
      <rect
        className="dg-box"
        width={rect.w}
        height={rect.h}
        rx={8}
        fill={`url(#${defsId}-node)`}
        stroke={selected ? '#087f5b' : active ? t.ring : state === 'visited' ? 'rgba(148,163,184,0.38)' : 'rgba(148,163,184,0.26)'}
        strokeWidth={active ? 1.6 : 1}
      />
      {IconCmp && (
        <g transform={`translate(${compact ? 10 : 12}, ${rect.h / 2 - iconSize / 2})`}>
          <rect width={iconSize} height={iconSize} rx={8} fill={t.bg} stroke={t.ring} strokeOpacity={active ? 0.6 : 0.25} />
          <IconCmp x={(iconSize - 16) / 2} y={(iconSize - 16) / 2} width={16} height={16} color={t.fg} strokeWidth={1.8} aria-hidden="true" />
        </g>
      )}
      <text x={IconCmp ? (compact ? 44 : 52) : 14} y={subtitle ? rect.h / 2 - 3 : rect.h / 2 + 4.5} fill="var(--diagram-text)" fontSize={compact ? 12 : 13} fontWeight={600}>
        {title}
      </text>
      {subtitle && (
        <text x={IconCmp ? (compact ? 44 : 52) : 14} y={rect.h / 2 + 13} fill="var(--diagram-muted)" fontSize={compact ? 10 : 10.5} >
          {subtitle}
        </text>
      )}
      {badge && (
        <g transform={`translate(${rect.w - 8}, -9)`}>
          <rect x={-(badge.length * 5.7 + 14)} width={badge.length * 5.7 + 14} height={17} rx={8.5} fill="var(--diagram-node)" stroke="rgba(148,163,184,0.35)" />
          <text x={-(badge.length * 5.7 + 14) / 2} y={11.8} textAnchor="middle" fill="var(--diagram-muted)" fontSize={9.5} fontWeight={600} letterSpacing="0.02em">
            {badge}
          </text>
        </g>
      )}
      {status && (
        <circle cx={rect.w - 12} cy={12} r={4} fill={STATUS_COLOR[status]}>
        </circle>
      )}
      {children}
    </g>
  );
});

/* ------------------------------------------------------------------ */
/* Edge                                                               */
/* ------------------------------------------------------------------ */

export interface DiagramEdgeProps {
  defsId: string;
  route: Route;
  kind: FlowKind;
  label?: string;
  state?: 'normal' | 'active' | 'visited' | 'dim' | 'hidden';
  animate?: boolean;
  bidirectional?: boolean;
  /** Seconds for one particle to travel the path. */
  speed?: number;
  particles?: number;
  labelOffset?: { x: number; y: number };
  opacityOverride?: number;
  reverseParticles?: boolean;
}

export const DiagramEdge = memo(function DiagramEdge({
  defsId,
  route: r,
  kind,
  label,
  state = 'normal',
  animate = true,
  bidirectional,
  speed = 3.6,
  particles = 1,
  labelOffset,
  opacityOverride,
  reverseParticles,
}: DiagramEdgeProps) {
  const f = FLOWS[kind];
  const opacity = opacityOverride ?? (state === 'hidden' ? 0 : state === 'dim' ? 0.14 : state === 'visited' ? 0.55 : state === 'active' ? 1 : 0.7);
  const active = state === 'active';
  const lx = r.mid.x + (labelOffset?.x ?? 0);
  const ly = r.mid.y + (labelOffset?.y ?? 0);
  const lw = label ? label.length * 5.5 + 14 : 0;
  return (
    <g className="dg-edge" style={{ opacity }} aria-hidden="true" data-kind={kind}>
      <path d={r.d} fill="none" stroke={f.color} strokeOpacity={active ? 0.95 : 0.6} strokeWidth={active ? 1.6 : 1.2} strokeDasharray={f.dash} strokeLinecap="round" markerEnd={`url(#${defsId}-arrow-${kind})`} markerStart={bidirectional ? `url(#${defsId}-arrow-${kind})` : undefined} />
      {active && animate && (
        <>
          {Array.from({ length: particles }, (_, i) => (
            <circle key={i} r={2} fill={f.color} opacity={0}>
              <animateMotion dur={`${speed}s`} repeatCount="indefinite" begin={`${(i * speed) / particles}s`} path={r.d} keyPoints={reverseParticles ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear" />
              <animate attributeName="opacity" dur={`${speed}s`} repeatCount="indefinite" begin={`${(i * speed) / particles}s`} values="0;1;1;0" keyTimes="0;0.1;0.85;1" />
            </circle>
          ))}
        </>
      )}
      {label && (
        <g transform={`translate(${lx}, ${ly})`} style={{ opacity: active ? 1 : 0.85 }}>
          <rect x={-lw / 2} y={-9} width={lw} height={18} rx={4} fill="var(--diagram-node)" stroke="var(--diagram-border)" />
          <text textAnchor="middle" y={3.6} fill={active ? 'var(--diagram-text)' : 'var(--diagram-muted)'} fontSize={10} fontWeight={550}>
            {label}
          </text>
        </g>
      )}
    </g>
  );
});

/* ------------------------------------------------------------------ */
/* HTML helpers                                                       */
/* ------------------------------------------------------------------ */

export function Legend({ kinds, className = '' }: { kinds: FlowKind[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-2 text-[0.75rem] text-fg-muted ${className}`} aria-label="Legend">
      {kinds.map((k) => (
        <li key={k} className="flex items-center gap-2" title={FLOWS[k].description}>
          <svg width="30" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="24" y2="5" stroke={FLOWS[k].color} strokeWidth={2} strokeDasharray={FLOWS[k].dash} strokeLinecap="round" />
            <path d="M23,1.5 L29,5 L23,8.5 z" fill={FLOWS[k].color} />
          </svg>
          {FLOWS[k].label}
        </li>
      ))}
    </ul>
  );
}
