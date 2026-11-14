// Production topologies for "How does LockLens fit into a real production system?"
//
// Everything outside the LockLens zone is an ILLUSTRATIVE example environment.
// LockLens components and their connections follow docs/deployment.md,
// docs/architecture.md (several servers) and docs/integrations.md.
import type { FlowKind } from '../diagram/flows';
import type { Tone } from '../diagram/primitives';
import type { NodeDetails } from './internal';

export type Mode = 'single' | 'cluster' | 'fleet' | 'ha';
export const MODES: { id: Mode; label: string; short: string }[] = [
  { id: 'single', label: 'Single instance', short: 'A' },
  { id: 'cluster', label: 'Production cluster', short: 'B' },
  { id: 'fleet', label: 'Microservices fleet', short: 'C' },
  { id: 'ha', label: 'Multi-instance LockLens', short: 'D' },
];

export const CANVAS = { w: 1500, h: 900 };

/** Camera per mode (5:3), so the scene visibly expands from A to D. */
export const FRAMES: Record<Mode, { x: number; y: number; w: number }> = {
  single: { x: 0, y: 4, w: 1300 },
  cluster: { x: 0, y: 30, w: 1460 },
  fleet: { x: 0, y: 0, w: 1500 },
  ha: { x: 0, y: 0, w: 1500 },
};

export type Layer = 'client' | 'entry' | 'service' | 'pool' | 'db' | 'locklens' | 'external' | 'people';
export type ClusterId = 'commerce' | 'payments' | 'reporting';

export interface Placement {
  x: number;
  y: number;
  w?: number;
  h?: number;
  title?: string;
  subtitle?: string;
}

export interface TopoNode {
  id: string;
  layer: Layer;
  title: string;
  subtitle?: string;
  icon: string;
  tone: Tone;
  badge?: 'example' | 'optional' | 'LockLens';
  cluster?: ClusterId;
  /** LockLens server identity in the multi-instance mode. */
  server?: 'a' | 'b' | 'c';
  at: Partial<Record<Mode, Placement>>;
  details: NodeDetails;
  illustrative?: boolean;
}

export interface TopoGroup {
  id: string;
  label: string;
  sublabel?: string;
  tone: Tone;
  dashed?: boolean;
  cluster?: ClusterId;
  at: Partial<Record<Mode, { x: number; y: number; w: number; h: number; label?: string; sublabel?: string }>>;
  badge?: string;
}

export interface TopoEdge {
  id: string;
  from: string;
  to: string;
  kind: FlowKind;
  modes: Mode[];
  label?: string;
  /** Monitoring edges are routed along a lane to a shared collection bus. */
  monitor?: { lane: 'primary' | 'replica' | 'single'; serverByMode?: Partial<Record<Mode, string>> };
  bidirectional?: boolean;
  /** 'over': leave from the side and enter the target from above; 'under': enter from below. */
  routeHint?: 'over' | 'under';
  /** For 'over' routes: the y of the horizontal run, per mode. */
  overY?: Partial<Record<Mode, number>>;
}

const docs = (label: string, slug: string) => ({ label, href: `/docs/${slug}/` });
const exampleDetails = (purpose: string, extra?: string): NodeDetails => ({
  kind: 'Illustrative example',
  purpose,
  note: extra ?? 'Part of the example environment, not of LockLens. LockLens does not connect to it.',
  docs: [docs('Production topology', 'architecture/production-topology')],
});

const pgDetails = (role: string, extra: string): NodeDetails => ({
  kind: `Monitored target · ${role}`,
  purpose: `${extra} LockLens connects to it with its own read-only role and a pool of 1–5 connections, separately from application traffic.`,
  data: ['Sessions, locks and blocking (pg_stat_activity, pg_blocking_pids())', 'Statement statistics (pg_stat_statements, optional)', 'Database counters, replication, settings and catalog'],
  note: 'The PostgreSQL server is real infrastructure you run; the name is an example. Each server (primary or standby) is its own LockLens target.',
  docs: [docs('PostgreSQL observation', 'architecture/postgresql-observation'), docs('Replication monitoring', 'features/replication')],
});

export const NODES: TopoNode[] = [
  // ---------------------------------------------------------------- clients
  {
    id: 'web', layer: 'client', title: 'Web app', subtitle: 'browsers', icon: 'Globe', tone: 'slate', badge: 'example', illustrative: true,
    at: { single: { x: 40, y: 236, title: 'Users', subtitle: 'web clients' }, cluster: { x: 30, y: 170 }, fleet: { x: 30, y: 150 }, ha: { x: 30, y: 150 } },
    details: exampleDetails('End users reaching your product. Their requests never touch LockLens.'),
  },
  {
    id: 'mobile', layer: 'client', title: 'Mobile apps', subtitle: 'iOS · Android', icon: 'Smartphone', tone: 'slate', badge: 'example', illustrative: true,
    at: { cluster: { x: 30, y: 250 }, fleet: { x: 30, y: 230 }, ha: { x: 30, y: 230 } },
    details: exampleDetails('Mobile clients of the example product.'),
  },
  {
    id: 'apiclients', layer: 'client', title: 'API clients', subtitle: 'partners · B2B', icon: 'Terminal', tone: 'slate', badge: 'example', illustrative: true,
    at: { fleet: { x: 30, y: 310 }, ha: { x: 30, y: 310 } },
    details: exampleDetails('External API consumers of the example product.'),
  },
  // ------------------------------------------------------------------ entry
  {
    id: 'lb', layer: 'entry', title: 'Load balancer', subtitle: 'TLS termination', icon: 'Split', tone: 'slate', badge: 'example', illustrative: true,
    at: { cluster: { x: 250, y: 210 }, fleet: { x: 250, y: 190 }, ha: { x: 250, y: 190 } },
    details: exampleDetails('Your edge load balancer. LockLens is not deployed in this path and needs no access to it.'),
  },
  {
    id: 'gateway', layer: 'entry', title: 'API gateway', subtitle: 'routing · limits', icon: 'Router', tone: 'slate', badge: 'example', illustrative: true,
    at: { fleet: { x: 250, y: 280 }, ha: { x: 250, y: 280 } },
    details: exampleDetails('Routes requests to backend services.'),
  },
  {
    id: 'authsvc', layer: 'entry', title: 'Auth service', subtitle: 'tokens · sessions', icon: 'KeyRound', tone: 'slate', badge: 'example', illustrative: true,
    at: { fleet: { x: 250, y: 370 }, ha: { x: 250, y: 370 } },
    details: exampleDetails('Authentication infrastructure for the example product. Unrelated to LockLens’ own users and roles.'),
  },
  // --------------------------------------------------------------- services
  {
    id: 'svc-orders', layer: 'service', title: 'Order service', icon: 'ShoppingCart', tone: 'slate', badge: 'example', illustrative: true,
    at: { single: { x: 330, y: 236, title: 'Your application', subtitle: 'any language' }, cluster: { x: 490, y: 130 }, fleet: { x: 490, y: 120 }, ha: { x: 490, y: 120 } },
    details: exampleDetails('An application service issuing SQL to PostgreSQL through its normal driver and pool.', 'LockLens sees this service’s sessions only as rows in pg_stat_activity (user, application_name, query). It does not instrument or trace the service.'),
  },
  {
    id: 'svc-inventory', layer: 'service', title: 'Inventory service', icon: 'Package', tone: 'slate', badge: 'example', illustrative: true,
    at: { cluster: { x: 490, y: 210 }, fleet: { x: 490, y: 186 }, ha: { x: 490, y: 186 } },
    details: exampleDetails('Example service using the commerce cluster.'),
  },
  {
    id: 'svc-users', layer: 'service', title: 'User service', icon: 'UserRound', tone: 'slate', badge: 'example', illustrative: true,
    at: { cluster: { x: 490, y: 290 }, fleet: { x: 490, y: 54 }, ha: { x: 490, y: 54 } },
    details: exampleDetails('Example service using the commerce cluster.'),
  },
  {
    id: 'svc-payments', layer: 'service', title: 'Payment service', icon: 'CreditCard', tone: 'slate', badge: 'example', illustrative: true,
    at: { fleet: { x: 490, y: 252 }, ha: { x: 490, y: 252 } },
    details: exampleDetails('Example service with its own payments cluster.'),
  },
  {
    id: 'svc-notify', layer: 'service', title: 'Notification service', icon: 'Bell', tone: 'slate', badge: 'example', illustrative: true,
    at: { fleet: { x: 490, y: 318 }, ha: { x: 490, y: 318 } },
    details: exampleDetails('Example service reading from a commerce replica.'),
  },
  {
    id: 'svc-reporting', layer: 'service', title: 'Reporting service', icon: 'Receipt', tone: 'slate', badge: 'example', illustrative: true,
    at: { fleet: { x: 490, y: 418 }, ha: { x: 490, y: 418 } },
    details: exampleDetails('Example service connecting directly to its database, without a pooler: poolers are optional.'),
  },
  // ------------------------------------------------------------------ pools
  {
    id: 'pool-commerce', layer: 'pool', title: 'PgBouncer', subtitle: 'commerce pool', icon: 'Layers', tone: 'slate', badge: 'optional', illustrative: true,
    at: { cluster: { x: 740, y: 210 }, fleet: { x: 740, y: 150 }, ha: { x: 740, y: 150 } },
    details: exampleDetails('An optional connection pooler for application connections.', 'LockLens does not need a pooler and does not monitor through one: it connects to each PostgreSQL server directly, because pg_stat_activity and pg_locks describe the server it is connected to.'),
  },
  {
    id: 'pool-payments', layer: 'pool', title: 'PgBouncer', subtitle: 'payments pool', icon: 'Layers', tone: 'slate', badge: 'optional', illustrative: true,
    at: { fleet: { x: 740, y: 296 }, ha: { x: 740, y: 296 } },
    details: exampleDetails('An optional connection pooler for the payments cluster.'),
  },
  // -------------------------------------------------------------- databases
  {
    id: 'pg-commerce', layer: 'db', title: 'commerce-primary', subtitle: 'PG 17 · primary', icon: 'Database', tone: 'cyan', cluster: 'commerce', server: 'a', illustrative: true,
    at: { single: { x: 780, y: 236, title: 'PostgreSQL', subtitle: 'one instance' }, cluster: { x: 990, y: 210 }, fleet: { x: 990, y: 110 }, ha: { x: 990, y: 110 } },
    details: pgDetails('primary', 'Accepts the application’s writes.'),
  },
  {
    id: 'pg-commerce-r1', layer: 'db', title: 'commerce-replica-1', subtitle: 'streaming standby', icon: 'Database', tone: 'cyan', cluster: 'commerce', server: 'a', illustrative: true,
    at: { cluster: { x: 1250, y: 150 }, fleet: { x: 1250, y: 76 }, ha: { x: 1250, y: 76 } },
    details: pgDetails('standby', 'Serves read-only application queries.'),
  },
  {
    id: 'pg-commerce-r2', layer: 'db', title: 'commerce-replica-2', subtitle: 'streaming standby', icon: 'Database', tone: 'cyan', cluster: 'commerce', server: 'c', illustrative: true,
    at: { cluster: { x: 1250, y: 270 }, fleet: { x: 1250, y: 146 }, ha: { x: 1250, y: 146 } },
    details: pgDetails('standby', 'A second standby.'),
  },
  {
    id: 'pg-payments', layer: 'db', title: 'payments-primary', subtitle: 'PG 16 · primary', icon: 'Database', tone: 'cyan', cluster: 'payments', server: 'b', illustrative: true,
    at: { fleet: { x: 990, y: 280 }, ha: { x: 990, y: 280 } },
    details: pgDetails('primary', 'An independent cluster: not a replica of commerce.'),
  },
  {
    id: 'pg-payments-r1', layer: 'db', title: 'payments-replica', subtitle: 'streaming standby', icon: 'Database', tone: 'cyan', cluster: 'payments', server: 'b', illustrative: true,
    at: { fleet: { x: 1250, y: 280 }, ha: { x: 1250, y: 280 } },
    details: pgDetails('standby', 'Standby of the payments primary.'),
  },
  {
    id: 'pg-reporting', layer: 'db', title: 'reporting-db', subtitle: 'PG 15 · standalone', icon: 'Database', tone: 'cyan', cluster: 'reporting', server: 'c', illustrative: true,
    at: { fleet: { x: 990, y: 418 }, ha: { x: 990, y: 418 } },
    details: pgDetails('standalone', 'A third, unrelated server with no replicas.'),
  },
  // --------------------------------------------------------------- LockLens
  {
    id: 'll-a', layer: 'locklens', title: 'locklens server', subtitle: 'collectors · rules', icon: 'Radar', tone: 'cyan', badge: 'LockLens', server: 'a',
    at: {
      single: { x: 780, y: 520 },
      cluster: { x: 900, y: 610 },
      fleet: { x: 900, y: 620 },
      ha: { x: 520, y: 630, title: 'locklens server A', subtitle: 'leases: 2 targets' },
    },
    details: {
      kind: 'LockLens · backend image',
      purpose: 'One Go process: one worker per target running read-only collectors on a schedule, the rules engine and incident recorder, notifications, metric exports, and the REST + SSE API.',
      data: ['Global limit LOCKLENS_MAX_CONCURRENT_COLLECTIONS (default 4)', 'A slow or failing target only affects its own worker', 'Tested locally with up to 20 targets on one machine; larger fleets not yet measured'],
      note: 'Out of band: if LockLens stops, applications keep working; LockLens’ own history gets a gap.',
      docs: [docs('Architecture', 'architecture'), docs('Collectors', 'architecture/collectors')],
    },
  },
  {
    id: 'll-b', layer: 'locklens', title: 'locklens server B', subtitle: 'leases: 2 targets', icon: 'Radar', tone: 'cyan', badge: 'LockLens', server: 'b',
    at: { ha: { x: 750, y: 630 } },
    details: {
      kind: 'LockLens · second backend',
      purpose: 'Same image, same LOCKLENS_STORE_DSN and LOCKLENS_MASTER_KEY. Renews leases on its share of targets every 15 s (lease TTL 45 s).',
      note: 'If it crashes, its leases expire and other servers take its targets within about a minute; that time is a gap in their history.',
      docs: [docs('High availability', 'deployment/high-availability')],
    },
  },
  {
    id: 'll-c', layer: 'locklens', title: 'locklens server C', subtitle: 'leases: 2 targets', icon: 'Radar', tone: 'cyan', badge: 'LockLens', server: 'c',
    at: { ha: { x: 980, y: 630 } },
    details: {
      kind: 'LockLens · third backend',
      purpose: 'Takes free or expired leases up to an even share. Once-per-cluster jobs (retention, rollups, baselines) hold a job lease, so each runs on one server.',
      docs: [docs('High availability', 'deployment/high-availability')],
    },
  },
  {
    id: 'll-store', layer: 'locklens', title: 'Monitoring store', subtitle: 'own PG / Timescale', icon: 'Database', tone: 'emerald', badge: 'LockLens',
    at: {
      single: { x: 1040, y: 520 },
      cluster: { x: 900, y: 740 },
      fleet: { x: 900, y: 760 },
      ha: { x: 750, y: 790, title: 'Shared monitoring store', subtitle: 'leases · history' },
    },
    details: {
      kind: 'LockLens · its own database',
      purpose: 'History, rollups, incidents with their evidence, users, API tokens, encrypted connection strings.',
      note: 'Never one of the monitored databases, and never your application’s database. In the multi-instance mode it is a single PostgreSQL that you make highly available with your usual tooling.',
      docs: [docs('Monitoring store', 'architecture/storage-and-retention')],
    },
  },
  {
    id: 'll-front', layer: 'locklens', title: 'LockLens frontend', subtitle: 'nginx · UI · /api/', icon: 'Monitor', tone: 'blue', badge: 'LockLens',
    at: { single: { x: 500, y: 520 }, cluster: { x: 580, y: 610 }, fleet: { x: 580, y: 620 }, ha: { x: 270, y: 730, title: 'Frontend / LB', subtitle: 'sticky sessions' } },
    details: {
      kind: 'LockLens · frontend image',
      purpose: 'Serves the React UI and proxies /api/ to the backend so the browser sees one origin. Only the frontend should be exposed to people.',
      note: 'With several backends, put them behind the frontend or any load balancer; sticky sessions keep SQL workspace cancellation on the right server.',
      docs: [docs('Deployment', 'deployment')],
    },
  },
  {
    id: 'oncall', layer: 'people', title: 'On-call engineers', subtitle: 'browser', icon: 'Users', tone: 'blue',
    at: { single: { x: 30, y: 520 }, cluster: { x: 290, y: 610 }, fleet: { x: 290, y: 620 }, ha: { x: 30, y: 730 } },
    details: {
      kind: 'People',
      purpose: 'Engineers open LockLens to investigate. Their browser talks only to the LockLens frontend — a path entirely separate from customer traffic.',
      data: ['Roles: administrator, operator, viewer'],
      docs: [docs('UI guide', 'getting-started/ui-guide'), docs('Security model', 'deployment/security')],
    },
  },
  {
    id: 'alerts', layer: 'external', title: 'Slack · Webhook · Email', subtitle: 'channels', icon: 'Send', tone: 'amber', badge: 'optional',
    at: { cluster: { x: 1250, y: 610 }, fleet: { x: 1250, y: 580 }, ha: { x: 1270, y: 700, title: 'Alerts & exports', subtitle: 'Slack · AM · Prom.' } },
    details: {
      kind: 'Destinations you configure',
      purpose: 'Incident events (opened, escalated, resolved, reminders) with severity, environment, rule and instance filters, silences and maintenance windows.',
      note: 'Messages never contain SQL text, connection strings or credentials.',
      docs: [docs('Notifications', 'features/notifications')],
    },
  },
  {
    id: 'alertmanager', layer: 'external', title: 'Alertmanager', subtitle: '→ your receivers', icon: 'Megaphone', tone: 'amber', badge: 'optional',
    at: { fleet: { x: 1250, y: 650 } },
    details: {
      kind: 'Prometheus Alertmanager channel',
      purpose: 'LockLens posts incidents to /api/v2/alerts; your Alertmanager routes decide who is paged with your existing receivers.',
      docs: [docs('Integrations', 'deployment/integrations')],
    },
  },
  {
    id: 'prometheus', layer: 'external', title: 'Prometheus', subtitle: '/metrics/targets', icon: 'ChartLine', tone: 'amber', badge: 'optional',
    at: { fleet: { x: 1250, y: 720 } },
    details: {
      kind: 'Pulled by your Prometheus',
      purpose: 'Instance metrics with target and environment labels; ready-to-use alerting rules are available.',
      note: 'With several servers, scrape every server: each exports the instances it collects.',
      docs: [docs('Integrations', 'deployment/integrations')],
    },
  },
];

export const GROUPS: TopoGroup[] = [
  {
    id: 'grp-app', label: 'Your production environment', sublabel: 'illustrative example', tone: 'slate', dashed: true,
    at: {
      single: { x: 20, y: 170, w: 980, h: 190, label: 'Your application', sublabel: 'illustrative example' },
      cluster: { x: 14, y: 70, w: 1470, h: 410 },
      fleet: { x: 14, y: 20, w: 1470, h: 470 },
      ha: { x: 14, y: 20, w: 1470, h: 470 },
    },
  },
  {
    id: 'grp-commerce', label: 'Commerce cluster', sublabel: 'primary + 2 standbys', tone: 'cyan', cluster: 'commerce',
    at: {
      cluster: { x: 970, y: 110, w: 490, h: 240, label: 'PostgreSQL cluster' },
      fleet: { x: 970, y: 40, w: 490, h: 176 },
      ha: { x: 970, y: 40, w: 490, h: 176 },
    },
  },
  {
    id: 'grp-payments', label: 'Payments cluster', sublabel: 'independent cluster', tone: 'cyan', cluster: 'payments',
    at: { fleet: { x: 970, y: 236, w: 490, h: 112 }, ha: { x: 970, y: 236, w: 490, h: 112 } },
  },
  {
    id: 'grp-reporting', label: 'Reporting', sublabel: 'standalone server', tone: 'cyan', cluster: 'reporting',
    at: { fleet: { x: 970, y: 368, w: 490, h: 106 }, ha: { x: 970, y: 368, w: 490, h: 106 } },
  },
  {
    id: 'grp-ll', label: 'LockLens · out of band', sublabel: 'observes PostgreSQL; never in the request path', tone: 'cyan', badge: 'read-only',
    at: {
      single: { x: 250, y: 456, w: 1010, h: 150 },
      cluster: { x: 540, y: 548, w: 600, h: 274 },
      fleet: { x: 540, y: 556, w: 600, h: 290 },
      ha: { x: 240, y: 566, w: 960, h: 314, sublabel: 'several servers share one store and split targets by leases' },
    },
  },
];

const ALL: Mode[] = ['single', 'cluster', 'fleet', 'ha'];
const BIG: Mode[] = ['fleet', 'ha'];

export const EDGES: TopoEdge[] = [
  // Application traffic (never through LockLens)
  { id: 'a-web-app', from: 'web', to: 'svc-orders', kind: 'app', modes: ['single'], label: 'HTTP' },
  { id: 'a-app-pg', from: 'svc-orders', to: 'pg-commerce', kind: 'app', modes: ['single'], label: 'SQL' },
  { id: 'a-web-lb', from: 'web', to: 'lb', kind: 'app', modes: ['cluster', ...BIG] },
  { id: 'a-mob-lb', from: 'mobile', to: 'lb', kind: 'app', modes: ['cluster', ...BIG] },
  { id: 'a-api-gw', from: 'apiclients', to: 'gateway', kind: 'app', modes: BIG },
  { id: 'a-lb-gw', from: 'lb', to: 'gateway', kind: 'app', modes: BIG },
  { id: 'a-gw-auth', from: 'gateway', to: 'authsvc', kind: 'app', modes: BIG, bidirectional: true },
  { id: 'a-lb-orders', from: 'lb', to: 'svc-orders', kind: 'app', modes: ['cluster'] },
  { id: 'a-lb-inv', from: 'lb', to: 'svc-inventory', kind: 'app', modes: ['cluster'] },
  { id: 'a-lb-users', from: 'lb', to: 'svc-users', kind: 'app', modes: ['cluster'] },
  { id: 'a-gw-users', from: 'gateway', to: 'svc-users', kind: 'app', modes: BIG },
  { id: 'a-gw-orders', from: 'gateway', to: 'svc-orders', kind: 'app', modes: BIG },
  { id: 'a-gw-inv', from: 'gateway', to: 'svc-inventory', kind: 'app', modes: BIG },
  { id: 'a-gw-pay', from: 'gateway', to: 'svc-payments', kind: 'app', modes: BIG },
  { id: 'a-gw-notify', from: 'gateway', to: 'svc-notify', kind: 'app', modes: BIG },
  { id: 'a-gw-rep', from: 'gateway', to: 'svc-reporting', kind: 'app', modes: BIG },
  { id: 'a-orders-pool', from: 'svc-orders', to: 'pool-commerce', kind: 'app', modes: ['cluster', ...BIG] },
  { id: 'a-inv-pool', from: 'svc-inventory', to: 'pool-commerce', kind: 'app', modes: ['cluster', ...BIG] },
  { id: 'a-users-pool', from: 'svc-users', to: 'pool-commerce', kind: 'app', modes: ['cluster', ...BIG] },
  { id: 'a-notify-pool', from: 'svc-notify', to: 'pool-commerce', kind: 'app', modes: BIG },
  { id: 'a-pay-pool', from: 'svc-payments', to: 'pool-payments', kind: 'app', modes: BIG },
  { id: 'a-pool-pg', from: 'pool-commerce', to: 'pg-commerce', kind: 'app', modes: ['cluster', ...BIG], label: 'writes' },
  { id: 'a-pool-r1', from: 'pool-commerce', to: 'pg-commerce-r1', kind: 'app', modes: ['cluster', ...BIG], label: 'reads', routeHint: 'over', overY: { cluster: 194, fleet: 96, ha: 96 } },
  { id: 'a-poolp-pg', from: 'pool-payments', to: 'pg-payments', kind: 'app', modes: BIG },
  { id: 'a-rep-pg', from: 'svc-reporting', to: 'pg-reporting', kind: 'app', modes: BIG, label: 'direct, no pooler' },
  // Replication (inside each cluster only)
  { id: 'r-c1', from: 'pg-commerce', to: 'pg-commerce-r1', kind: 'repl', modes: ['cluster', ...BIG] },
  { id: 'r-c2', from: 'pg-commerce', to: 'pg-commerce-r2', kind: 'repl', modes: ['cluster', ...BIG] },
  { id: 'r-p1', from: 'pg-payments', to: 'pg-payments-r1', kind: 'repl', modes: BIG },
  // Monitoring: LockLens' own read-only connections, one target per server
  { id: 'm-commerce', from: 'pg-commerce', to: 'll-a', kind: 'collect', modes: ALL, monitor: { lane: 'primary', serverByMode: { ha: 'll-a' } } },
  { id: 'm-commerce-r1', from: 'pg-commerce-r1', to: 'll-a', kind: 'collect', modes: ['cluster', ...BIG], monitor: { lane: 'replica', serverByMode: { ha: 'll-a' } } },
  { id: 'm-commerce-r2', from: 'pg-commerce-r2', to: 'll-a', kind: 'collect', modes: ['cluster', ...BIG], monitor: { lane: 'replica', serverByMode: { ha: 'll-c' } } },
  { id: 'm-payments', from: 'pg-payments', to: 'll-a', kind: 'collect', modes: BIG, monitor: { lane: 'primary', serverByMode: { ha: 'll-b' } } },
  { id: 'm-payments-r1', from: 'pg-payments-r1', to: 'll-a', kind: 'collect', modes: BIG, monitor: { lane: 'replica', serverByMode: { ha: 'll-b' } } },
  { id: 'm-reporting', from: 'pg-reporting', to: 'll-a', kind: 'collect', modes: BIG, monitor: { lane: 'primary', serverByMode: { ha: 'll-c' } } },
  // LockLens internals and people
  { id: 's-a-store', from: 'll-a', to: 'll-store', kind: 'store', modes: ALL, bidirectional: true },
  { id: 's-b-store', from: 'll-b', to: 'll-store', kind: 'store', modes: ['ha'], bidirectional: true },
  { id: 's-c-store', from: 'll-c', to: 'll-store', kind: 'store', modes: ['ha'], bidirectional: true },
  { id: 'u-oncall', from: 'oncall', to: 'll-front', kind: 'api', modes: ALL, label: 'HTTPS' },
  { id: 'u-front-a', from: 'll-front', to: 'll-a', kind: 'api', modes: ALL, label: '/api/', bidirectional: true },
  { id: 'u-front-b', from: 'll-front', to: 'll-b', kind: 'api', modes: ['ha'], bidirectional: true, routeHint: 'under' },
  { id: 'u-front-c', from: 'll-front', to: 'll-c', kind: 'api', modes: ['ha'], bidirectional: true, routeHint: 'under' },
  // Alerts and telemetry
  { id: 't-alerts', from: 'll-a', to: 'alerts', kind: 'alert', modes: ['cluster', 'fleet'] },
  { id: 't-alerts-ha', from: 'll-c', to: 'alerts', kind: 'alert', modes: ['ha'] },
  { id: 't-am', from: 'll-a', to: 'alertmanager', kind: 'alert', modes: ['fleet'] },
  { id: 't-prom', from: 'll-a', to: 'prometheus', kind: 'alert', modes: ['fleet'], label: 'scraped' },
];

export interface ModeCopy {
  title: string;
  lead: string;
  points: string[];
  caveat: string;
  docs: { label: string; href: string }[];
}

export const MODE_COPY: Record<Mode, ModeCopy> = {
  single: {
    title: 'Start with one database',
    lead: 'One application, one PostgreSQL server, one LockLens deployment (backend, frontend, store) and one dashboard.',
    points: [
      'Create a role with pg_read_all_stats and paste its connection string in Settings → Instances.',
      'The application keeps talking to PostgreSQL exactly as before; LockLens opens its own small read-only pool.',
      'make up starts the backend, frontend and store with random secrets on 127.0.0.1.',
    ],
    caveat: 'Collection has a cost: catalog queries on a schedule, and pg_blocking_pids() briefly locks the lock manager per waiting backend.',
    docs: [docs('Quickstart', 'getting-started'), docs('PostgreSQL permissions', 'architecture/postgresql-observation')],
  },
  cluster: {
    title: 'Alongside a production cluster',
    lead: 'Services reach a primary and its streaming standbys through their usual pooler. LockLens monitors every server as its own target and shows replication health.',
    points: [
      'Add the primary and each standby; standbys can reuse the roles created on the primary.',
      'Replication topology, replay lag, slots and retained WAL come from pg_stat_replication and pg_replication_slots.',
      'Blocking chains, slow statements and incidents are per server; notifications go to the channels you configure.',
    ],
    caveat: 'PgBouncer is part of the example environment. LockLens never needs it and connects to each server directly.',
    docs: [docs('Replication monitoring', 'features/replication'), docs('Production topology', 'architecture/production-topology')],
  },
  fleet: {
    title: 'A microservices fleet with several clusters',
    lead: 'Many services, independent PostgreSQL clusters, and your existing observability stack. LockLens is one more consumer of PostgreSQL statistics — never a proxy.',
    points: [
      'Instances are grouped by environment; per-environment and per-instance rule overrides apply.',
      'Incidents go to Slack, webhooks, email or Alertmanager; metrics to Prometheus (/metrics/targets).',
      'LockLens sees database sessions labelled by user and application_name — it does not trace requests across services.',
    ],
    caveat: 'Tested locally with up to 20 targets on one machine. Larger fleets have not been measured.',
    docs: [docs('Integrations', 'deployment/integrations'), docs('Limitations', 'deployment/limitations')],
  },
  ha: {
    title: 'Several LockLens servers, one store',
    lead: 'Run two or more backends with the same store and master key. They split targets by leases (45 s, renewed every 15 s) and take over each other’s targets.',
    points: [
      'Each target is collected by the server holding its lease; once-per-cluster jobs hold a job lease.',
      'Browser events and requests travel between servers over PostgreSQL LISTEN/NOTIFY; live views are shared through the store.',
      'Scrape every server with Prometheus: each exports the instances it collects.',
    ],
    caveat: 'Not exactly-once and not seamless: a crashed server’s targets move within about a minute (a gap in history), and two servers can briefly collect the same target around a takeover. The store itself is a single PostgreSQL.',
    docs: [docs('High availability', 'deployment/high-availability'), docs('Deployment: several servers', 'deployment')],
  },
};

export const CLUSTERS: { id: ClusterId; label: string; modes: Mode[] }[] = [
  { id: 'commerce', label: 'Commerce', modes: ['cluster', 'fleet', 'ha'] },
  { id: 'payments', label: 'Payments', modes: ['fleet', 'ha'] },
  { id: 'reporting', label: 'Reporting', modes: ['fleet', 'ha'] },
];
