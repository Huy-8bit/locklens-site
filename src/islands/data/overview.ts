import { NODES, EDGES } from "./internal";
import type { Rect } from "../diagram/geometry";

// A projection of the detailed model: every displayed edge retains the IDs of
// real underlying relationships. No separate topology is maintained here.
export const OVERVIEW_GROUPS = [
  {
    id: "targets",
    title: "PostgreSQL & host",
    subtitle: "Targets and optional agents",
    icon: "Database",
    members: [
      "t-sessions",
      "t-statements",
      "t-counters",
      "t-replication",
      "t-catalog",
      "node-exporter",
      "log-agent",
    ],
    representative: "t-sessions",
    rect: { x: 24, y: 65, w: 190, h: 74 },
  },
  {
    id: "collection",
    title: "Collection",
    subtitle: "Schedules, rates, live state",
    icon: "Radar",
    members: [
      "registry",
      "manager",
      "collectors",
      "deltas",
      "live",
      "writer",
      "graph",
      "changes",
      "cluster",
    ],
    representative: "collectors",
    rect: { x: 275, y: 65, w: 190, h: 74 },
  },
  {
    id: "analysis",
    title: "Analysis & incidents",
    subtitle: "Findings with evidence",
    icon: "ShieldCheck",
    members: ["rules", "recorder", "insight", "optimizer"],
    representative: "recorder",
    rect: { x: 526, y: 65, w: 190, h: 74 },
  },
  {
    id: "delivery",
    title: "Alerts & telemetry",
    subtitle: "Configured destinations",
    icon: "Bell",
    members: [
      "notifier",
      "channels",
      "alertmanager",
      "telemetry",
      "prometheus",
    ],
    representative: "notifier",
    rect: { x: 777, y: 65, w: 190, h: 74 },
  },
  {
    id: "store",
    title: "Monitoring store",
    subtitle: "History, findings, incidents",
    icon: "Database",
    members: ["store", "jobs"],
    representative: "store",
    rect: { x: 275, y: 285, w: 235, h: 74 },
  },
  {
    id: "access",
    title: "API & web interface",
    subtitle: "Authenticated live access",
    icon: "Monitor",
    members: ["api", "auth", "frontend", "ui"],
    representative: "api",
    rect: { x: 650, y: 285, w: 235, h: 74 },
  },
] satisfies {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  members: string[];
  representative: string;
  rect: Rect;
}[];
const membership = new Map(
  OVERVIEW_GROUPS.flatMap((g) => g.members.map((id) => [id, g.id] as const)),
);
const groups = new Map<
  string,
  {
    id: string;
    from: string;
    to: string;
    kind: (typeof EDGES)[number]["kind"];
    sourceEdges: string[];
  }
>();
for (const edge of EDGES) {
  const from = membership.get(edge.from),
    to = membership.get(edge.to);
  if (!from || !to || from === to) continue;
  const key = `${from}:${to}:${edge.kind}`;
  const previous = groups.get(key);
  if (previous) previous.sourceEdges.push(edge.id);
  else
    groups.set(key, {
      id: key,
      from,
      to,
      kind: edge.kind,
      sourceEdges: [edge.id],
    });
}
export const OVERVIEW_EDGES = [...groups.values()];
export const overviewDetails = (id: string) => {
  const group = OVERVIEW_GROUPS.find((g) => g.id === id)!;
  return NODES.find((n) => n.id === group.representative)!.details;
};
