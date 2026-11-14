// Path routing for diagram edges. Edges are either smooth cubic curves
// between two node sides, or orthogonal routes through explicit waypoints
// with rounded corners. Both return an SVG path and a label anchor.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Side = 'l' | 'r' | 't' | 'b';
export interface Pt {
  x: number;
  y: number;
}

export interface RouteOptions {
  from?: Side;
  to?: Side;
  /** Shift the anchor along the side, in px (positive = right/down). */
  fromOffset?: number;
  toOffset?: number;
  /** Orthogonal waypoints between the two anchors. */
  via?: Pt[];
  /** Corner radius for orthogonal routes. */
  radius?: number;
}

export function anchor(r: Rect, side: Side, offset = 0): Pt {
  switch (side) {
    case 'l':
      return { x: r.x, y: r.y + r.h / 2 + offset };
    case 'r':
      return { x: r.x + r.w, y: r.y + r.h / 2 + offset };
    case 't':
      return { x: r.x + r.w / 2 + offset, y: r.y };
    case 'b':
      return { x: r.x + r.w / 2 + offset, y: r.y + r.h };
  }
}

function autoSides(a: Rect, b: Rect): [Side, Side] {
  const acx = a.x + a.w / 2;
  const bcx = b.x + b.w / 2;
  const acy = a.y + a.h / 2;
  const bcy = b.y + b.h / 2;
  if (b.x >= a.x + a.w - 4) return ['r', 'l'];
  if (b.x + b.w <= a.x + 4) return ['l', 'r'];
  if (bcy >= acy) return ['b', 't'];
  if (Math.abs(bcx - acx) < 1) return ['t', 'b'];
  return ['t', 'b'];
}

const normal: Record<Side, Pt> = { l: { x: -1, y: 0 }, r: { x: 1, y: 0 }, t: { x: 0, y: -1 }, b: { x: 0, y: 1 } };

function cubicPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

export interface Route {
  d: string;
  mid: Pt;
  start: Pt;
  end: Pt;
}

export function route(a: Rect, b: Rect, opts: RouteOptions = {}): Route {
  const [fs, ts] = autoSides(a, b);
  const fromSide = opts.from ?? fs;
  const toSide = opts.to ?? ts;
  const p0 = anchor(a, fromSide, opts.fromOffset);
  const p3 = anchor(b, toSide, opts.toOffset);

  if (opts.via && opts.via.length) {
    const pts = [p0, ...opts.via, p3];
    return { d: roundedPolyline(pts, opts.radius ?? 10), mid: polylineMid(pts), start: p0, end: p3 };
  }

  const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  const k = Math.max(28, Math.min(160, dist * 0.45));
  const n0 = normal[fromSide];
  const n3 = normal[toSide];
  const p1 = { x: p0.x + n0.x * k, y: p0.y + n0.y * k };
  const p2 = { x: p3.x + n3.x * k, y: p3.y + n3.y * k };
  const f = (n: number) => Math.round(n * 10) / 10;
  return {
    d: `M${f(p0.x)},${f(p0.y)} C${f(p1.x)},${f(p1.y)} ${f(p2.x)},${f(p2.y)} ${f(p3.x)},${f(p3.y)}`,
    mid: cubicPoint(p0, p1, p2, p3, 0.5),
    start: p0,
    end: p3,
  };
}

function roundedPolyline(pts: Pt[], r: number): string {
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = { x: cur.x + ((prev.x - cur.x) / (d1 || 1)) * rr, y: cur.y + ((prev.y - cur.y) / (d1 || 1)) * rr };
    const b = { x: cur.x + ((next.x - cur.x) / (d2 || 1)) * rr, y: cur.y + ((next.y - cur.y) / (d2 || 1)) * rr };
    d += ` L${f(a.x)},${f(a.y)} Q${f(cur.x)},${f(cur.y)} ${f(b.x)},${f(b.y)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${f(last.x)},${f(last.y)}`;
  return d;
}

function polylineMid(pts: Pt[]): Pt {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = segs.reduce((s, n) => s + n, 0);
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= total / 2) {
      const t = (total / 2 - acc) / (segs[i] || 1);
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
    }
    acc += segs[i];
  }
  return pts[0];
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
export function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
