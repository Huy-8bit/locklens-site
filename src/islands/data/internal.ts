// LockLens internal architecture, as documented in docs/architecture.md,
// docs/collectors.md, docs/deployment.md and docs/integrations.md.
// Positions are in a 1500 × 860 canvas.
import type { FlowKind } from '../diagram/flows';
import type { Pt, Rect, RouteOptions } from '../diagram/geometry';
import type { Tone } from '../diagram/primitives';

export const CANVAS = { w: 1500, h: 860 };

export interface ArchNode {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  tone: Tone;
  rect: Rect;
  badge?: string;
  details: NodeDetails;
}

export interface NodeDetails {
  kind: string;
  purpose: string;
  data?: string[];
  source?: string;
  schedule?: string;
  refs?: string[];
  docs?: { label: string; href: string }[];
  note?: string;
}

export interface ArchEdge {
  id: string;
  from: string;
  to: string;
  kind: FlowKind;
  label?: string;
  opts?: RouteOptions;
  bidirectional?: boolean;
  labelOffset?: Pt;
  speed?: number;
}

export interface ArchGroup {
  id: string;
  label: string;
  sublabel?: string;
  rect: Rect;
  tone: Tone;
  dashed?: boolean;
  badge?: string;
}

const W = 220;
const H = 58;
const col = { tgt: 44, c1: 354, c2: 610, c3: 866, out: 1172 };
const row = (i: number) => 114 + i * 84;

export const GROUPS: ArchGroup[] = [
  { id: 'g-target', label: 'Monitored PostgreSQL', sublabel: 'read-only role · pg_read_all_stats', rect: { x: 24, y: 48, w: 260, h: 514 }, tone: 'cyan' },
  { id: 'g-host', label: 'Database host', sublabel: 'optional agents', rect: { x: 24, y: 578, w: 260, h: 214 }, tone: 'slate', dashed: true },
  { id: 'g-server', label: 'locklens server', sublabel: 'one Go process · modular monolith · backend image', rect: { x: 330, y: 48, w: 780, h: 562 }, tone: 'blue', badge: 'single binary' },
  { id: 'g-store', label: 'Monitoring store', sublabel: 'LockLens’ own database, never a monitored one', rect: { x: 330, y: 636, w: 780, h: 156 }, tone: 'emerald' },
  { id: 'g-ui', label: 'Presentation', sublabel: 'frontend image + your browser', rect: { x: 1150, y: 48, w: 326, h: 210 }, tone: 'blue' },
  { id: 'g-out', label: 'Alerts & integrations', sublabel: 'only the destinations you configure', rect: { x: 1150, y: 278, w: 326, h: 380 }, tone: 'amber', dashed: true },
];

export const COLUMN_CAPTIONS = [
  { x: col.c1 + 2, y: 103, text: 'COLLECT' },
  { x: col.c2 + 2, y: 103, text: 'ANALYSE' },
  { x: col.c3 + 2, y: 103, text: 'SERVE & DELIVER' },
];

const docs = (label: string, slug: string) => ({ label, href: `/docs/${slug}/` });

export const NODES: ArchNode[] = [
  // --- Monitored PostgreSQL -------------------------------------------------
  {
    id: 't-sessions', title: 'Sessions & locks', subtitle: 'pg_stat_activity · pg_locks', icon: 'Lock', tone: 'cyan', rect: { x: col.tgt, y: row(0), w: W, h: H },
    details: {
      kind: 'PostgreSQL statistics views',
      purpose: 'The live state of every client session: what it runs, how long its transaction is open, what it waits for, and who blocks it.',
      data: ['pg_stat_activity (state, wait events, query_id, ages)', 'pg_blocking_pids() for every waiting backend: the only source of blocking edges', 'pg_locks (waiting locks only)', 'pg_prepared_xacts, pg_stat_progress_vacuum, max_connections'],
      source: 'Read by the activity collector (every interval, default 10 s) and the load sampler (every 2 s, never the query text).',
      schedule: 'activity: target interval (5–3600 s, default 10 s); load: 2 s',
      refs: ['backend/internal/targetdb/queries/', 'backend/internal/domain/collector/'],
      docs: [docs('PostgreSQL observation', 'architecture/postgresql-observation'), docs('Blocking analysis', 'features/blocking-analysis')],
      note: 'A snapshot is assembled from several reads and is not atomic; blocking shorter than the interval can be missed.',
    },
  },
  {
    id: 't-statements', title: 'Statement statistics', subtitle: 'pg_stat_statements', icon: 'ChartColumn', tone: 'cyan', rect: { x: col.tgt, y: row(1), w: W, h: H },
    details: {
      kind: 'PostgreSQL extension (optional, recommended)',
      purpose: 'Cumulative per-statement counters: calls, execution time, rows, buffers. LockLens turns them into per-collection deltas and compares each statement with its own baseline.',
      data: ['pg_stat_statements(false): counters without texts', 'Texts only for statements not seen before', 'pg_stat_statements_info (evictions, resets)'],
      schedule: 'statements: max(interval, 15 s) by default',
      refs: ['backend/internal/domain/collector/statements.go'],
      docs: [docs('Query analysis', 'features/query-analysis'), docs('Query performance intelligence', 'features/query-performance')],
      note: 'Only window means, no per-execution samples. Without the extension the statements collector is disabled with the exact reason.',
    },
  },
  {
    id: 't-counters', title: 'Database counters', subtitle: 'pg_stat_database · wal', icon: 'Gauge', tone: 'cyan', rect: { x: col.tgt, y: row(2), w: W, h: H },
    details: {
      kind: 'PostgreSQL statistics views',
      purpose: 'Commit/rollback rates, cache hits, temp files, deadlocks, checkpoints, I/O, WAL rate, archiver, plus table and index activity.',
      data: ['pg_stat_database, pg_stat_bgwriter, pg_stat_checkpointer (17+), pg_stat_io (16+)', 'pg_stat_user_tables / indexes (tables every 5 min, the 20 busiest every minute)'],
      schedule: 'database: max(interval, 15 s); tables: 5 min; table_activity: max(interval, 60 s)',
      refs: ['backend/internal/domain/collector/counters.go'],
    },
  },
  {
    id: 't-replication', title: 'Replication', subtitle: 'pg_stat_replication', icon: 'GitBranch', tone: 'cyan', rect: { x: col.tgt, y: row(3), w: W, h: H },
    details: {
      kind: 'PostgreSQL statistics views',
      purpose: 'Role (primary or standby), connected replicas and their replay lag, replication slots and retained WAL, standby receive/replay state.',
      data: ['pg_stat_replication, pg_replication_slots', 'pg_stat_wal_receiver and recovery functions on standbys'],
      schedule: 'replication: max(interval, 30 s); 10 s during a burst',
      docs: [docs('Replication monitoring', 'features/replication')],
    },
  },
  {
    id: 't-catalog', title: 'Settings & catalog', subtitle: 'pg_settings · pg_index', icon: 'ListTree', tone: 'cyan', rect: { x: col.tgt, y: row(4), w: W, h: H },
    details: {
      kind: 'PostgreSQL catalogs',
      purpose: 'Settings and server facts for the change timeline; schema, indexes and column statistics (no data values) for the query optimizer.',
      data: ['pg_settings, pg_postmaster_start_time(), pg_conf_load_time(), pg_is_in_recovery()', 'pg_index, pg_class, pg_constraint, pg_stats (null_frac, n_distinct, correlation only)'],
      schedule: 'changes: 1 min; catalog: 15 min and on request',
      docs: [docs('Query optimizer', 'features/query-optimizer')],
    },
  },
  // --- Database host (optional) ------------------------------------------------
  {
    id: 'node-exporter', title: 'node_exporter', subtitle: 'host metrics', icon: 'Cpu', tone: 'slate', badge: 'optional', rect: { x: col.tgt, y: 624, w: W, h: H },
    details: {
      kind: 'Third-party exporter on the database host',
      purpose: 'PostgreSQL does not expose CPU, memory, or disk. If a target has a node_exporter URL, the host collector scrapes it.',
      schedule: 'host: max(interval, 15 s), 5 s HTTP timeout, responses over 8 MiB rejected',
      note: 'Must run on the database host. Managed services (RDS, Cloud SQL, Azure) do not offer it; the UI then shows host metrics as unavailable, never as zero.',
    },
  },
  {
    id: 'log-agent', title: 'locklens agent', subtitle: 'server log shipper', icon: 'FileText', tone: 'slate', badge: 'optional', rect: { x: col.tgt, y: 708, w: W, h: H },
    details: {
      kind: 'Same binary, agent mode',
      purpose: 'Follows PostgreSQL log files and ships slow statements, auto_explain plans, lock waits, deadlocks, autovacuum runs, temp files, checkpoints and errors.',
      data: ['Statement texts normalised and messages redacted before they leave the host', 'Spools to disk while the server cannot be reached'],
      source: 'POST /api/v1/ingest/logs with a token of scope ingest. It never connects to PostgreSQL.',
      refs: ['backend/internal/agent/', 'backend/internal/lib/pglog/'],
      docs: [docs('Deployment: log agent', 'deployment')],
    },
  },
  // --- Collect --------------------------------------------------------------------
  {
    id: 'registry', title: 'Target registry', subtitle: 'encrypted DSNs', icon: 'KeyRound', tone: 'blue', rect: { x: col.c1, y: row(0), w: W, h: H },
    details: {
      kind: 'domain/targets, domain/onboard',
      purpose: 'Validates new instances, encrypts connection strings with AES-256-GCM (LOCKLENS_MASTER_KEY), tests connections, and notifies the collector manager.',
      data: ['Only display fields (host, port, database, user) are stored in clear text', 'The API never returns a DSN'],
      refs: ['backend/internal/domain/targets/', 'backend/internal/lib/secret/'],
      docs: [docs('Security model', 'deployment/security')],
    },
  },
  {
    id: 'manager', title: 'Collector manager', subtitle: 'one worker per target', icon: 'Workflow', tone: 'blue', rect: { x: col.c1, y: row(1), w: W, h: H },
    details: {
      kind: 'domain/collector (collector.Manager)',
      purpose: 'Keeps one worker goroutine per enabled target. Each worker owns a small pgx pool, detects capabilities, and runs its collectors one at a time.',
      data: ['Global semaphore: LOCKLENS_MAX_CONCURRENT_COLLECTIONS (default 4)', 'Per-target pool of 1–5 connections (default 2)', 'Reconnects back off up to 1 minute'],
      schedule: 'Targets re-read on change; with several servers, leases are synced every 15 s',
      refs: ['backend/internal/domain/collector/manager.go', 'backend/internal/domain/collector/worker.go'],
    },
  },
  {
    id: 'collectors', title: 'Collectors', subtitle: 'read-only · scheduled', icon: 'Radar', tone: 'cyan', rect: { x: col.c1, y: row(2), w: W, h: H },
    details: {
      kind: 'domain/collector, targetdb',
      purpose: 'Read-only SQL on their own schedules: activity, load, database, statements, replication, tables, table_activity, changes, catalog, host.',
      data: ['default_transaction_read_only=on and a READ ONLY transaction for every collection', 'statement_timeout 30 s, lock_timeout 2 s, idle_in_transaction_session_timeout 60 s', 'application_name = locklens; LockLens’ own PIDs are excluded'],
      schedule: 'Adaptive sampling: during a problem, activity every 3 s and statements every 5 s for 10 minutes. A collector over 10% of its interval three times runs less often.',
      refs: ['backend/internal/domain/collector/', 'backend/internal/targetdb/'],
      note: 'Collectors never run DDL/DML, never cancel or terminate backends, never change settings.',
    },
  },
  {
    id: 'deltas', title: 'Counters → rates', subtitle: 'unknown ≠ zero', icon: 'Activity', tone: 'blue', rect: { x: col.c1, y: row(3), w: W, h: H },
    details: {
      kind: 'collector/counters.go, collector/statements.go',
      purpose: 'Cumulative counters become per-second rates or per-collection deltas at ingest, against the previous sample of the same target and scope.',
      data: ['Unknown (NULL, shown as a gap) on first sample, restart, stats reset, counter decrease, or a gap of more than 3 intervals'],
    },
  },
  {
    id: 'live', title: 'Live state', subtitle: 'in memory · bounded', icon: 'Zap', tone: 'blue', rect: { x: col.c1, y: row(4), w: W, h: H },
    details: {
      kind: 'domain/live',
      purpose: 'Latest values and a bounded history per target, used by live pages and by the rules. Live data comes from memory, so it does not wait for the store.',
      data: ['Up to 360 points per metric and 120 statement collections per target'],
      note: 'With several servers, the collecting server publishes each live view to live_state every 5 s so any server can answer.',
      docs: [docs('Architecture: design decisions', 'architecture')],
    },
  },
  {
    id: 'writer', title: 'Writer', subtitle: 'bounded queue · retries', icon: 'Layers', tone: 'emerald', rect: { x: col.c1, y: row(5), w: W, h: H },
    details: {
      kind: 'domain/collector (writer)',
      purpose: 'The only component that writes collected data to the store. Applies batches in order with retries.',
      data: ['Queue of LOCKLENS_WRITE_QUEUE batches (default 2048)', 'When full, the oldest batch is dropped, counted, and later recorded as a collection gap'],
      note: 'Memory use is bounded and loss is visible rather than silent.',
    },
  },
  // --- Analyse --------------------------------------------------------------------
  {
    id: 'graph', title: 'Blocking graph', subtitle: 'pg_blocking_pids()', icon: 'Waypoints', tone: 'violet', rect: { x: col.c2, y: row(0), w: W, h: H },
    details: {
      kind: 'domain/graph, domain/report',
      purpose: 'Builds the blocker → waiter graph from each activity snapshot: root blockers, direct and total counts, cycles, components.',
      data: ['Edges only from pg_blocking_pids(), never inferred from a pg_locks self-join', 'Parallel workers folded into leaders; prepared transactions as PID 0'],
      refs: ['backend/internal/domain/graph/graph.go', 'backend/internal/domain/report/report.go'],
      docs: [docs('Blocking analysis', 'features/blocking-analysis')],
      note: 'A cycle in sampled data is labelled as such, not as a confirmed deadlock.',
    },
  },
  {
    id: 'rules', title: 'Rules engine', subtitle: 'deterministic · versioned', icon: 'ShieldCheck', tone: 'violet', rect: { x: col.c2, y: row(1), w: W, h: H },
    details: {
      kind: 'domain/rules, domain/finding',
      purpose: 'Evaluates deterministic Go rules on the in-memory history after each activity collection. Findings carry evidence, explanation, next checks and limitations.',
      data: ['Missing data never makes a rule pass: it yields insufficient_data', 'Modes per rule: incident + notify, finding only, off; overridable per environment and instance'],
      refs: ['backend/internal/domain/rules/engine.go'],
      docs: [docs('Rules & findings', 'features/rules')],
    },
  },
  {
    id: 'recorder', title: 'Incident recorder', subtitle: 'evidence · timeline', icon: 'Siren', tone: 'rose', rect: { x: col.c2, y: row(2), w: W, h: H },
    details: {
      kind: 'domain/incidents',
      purpose: 'Opens, extends, and resolves incidents from trigger findings. An incident is an append-only recording: samples before the trigger, the trigger, its evolution, and how it ended.',
      data: ['Pre-trigger buffer of 30 samples (in memory)', 'Blocking snapshots on every graph change, sessions, load before the trigger', 'Resolves after 3 samples without the condition; 10-minute cooldown; max 2 h, 1,000 events or 5 MiB'],
      refs: ['backend/internal/domain/incidents/'],
      docs: [docs('Incident investigation', 'features/incidents')],
    },
  },
  {
    id: 'insight', title: 'Query intelligence', subtitle: 'baselines · hypotheses', icon: 'Microscope', tone: 'violet', rect: { x: col.c2, y: row(3), w: W, h: H },
    details: {
      kind: 'domain/baseline, domain/insight',
      purpose: 'Compares each statement with its own baseline (median and MAD by hour of day, from five-minute rollups), ranks findings by impact, and correlates evidence into ranked hypotheses.',
      note: 'Hypotheses are never presented as confirmed causes. LockLens never runs EXPLAIN ANALYZE.',
      docs: [docs('Query performance intelligence', 'features/query-performance')],
    },
  },
  {
    id: 'optimizer', title: 'Query optimizer', subtitle: 'recommendations', icon: 'Lightbulb', tone: 'violet', rect: { x: col.c2, y: row(4), w: W, h: H },
    details: {
      kind: 'domain/optimizer, lib/sqlparse',
      purpose: 'Turns each database’s schema and workload into recommendations (indexes to add or drop, stale statistics, spills to disk) with evidence and the SQL to apply.',
      data: ['Statement analysis with PostgreSQL’s own parser (pg_query_go, cgo)', 'Optional what-if checks with hypothetical indexes (HypoPG)'],
      note: 'LockLens never changes a database. A person reviews and applies the SQL; LockLens then measures before and after.',
      docs: [docs('Query optimizer', 'features/query-optimizer')],
    },
  },
  {
    id: 'changes', title: 'Change timeline', subtitle: 'settings · schema', icon: 'CalendarClock', tone: 'violet', rect: { x: col.c2, y: row(5), w: W, h: H },
    details: {
      kind: 'domain/changes',
      purpose: 'Diffs settings and server facts every minute and the schema every 15 minutes; records restarts, promotions, upgrades, index changes. Deploys and migrations can be reported via the API.',
      note: 'Changes are drawn on every chart and weighed as leads, never as confirmed causes.',
    },
  },
  // --- Serve & deliver ------------------------------------------------------------
  {
    id: 'api', title: 'HTTP API', subtitle: 'REST · SSE · /api/v1', icon: 'Network', tone: 'blue', rect: { x: col.c3, y: row(0), w: W, h: H },
    details: {
      kind: 'transport/httpapi',
      purpose: 'Serves live values from memory and history from the store, and publishes server-sent events (target.collected, target.status, incident.updated) that tell the UI what to refresh.',
      data: ['Also: POST /api/v1/changes (deploys), /api/v1/ingest/logs (log agent), incident export/import', '/healthz, /readyz, /metrics on the backend port'],
      refs: ['backend/internal/transport/httpapi/'],
      docs: [docs('HTTP API', 'reference/api')],
    },
  },
  {
    id: 'auth', title: 'Auth & roles', subtitle: 'sessions · tokens', icon: 'Shield', tone: 'blue', rect: { x: col.c3, y: row(1), w: W, h: H },
    details: {
      kind: 'domain/auth, domain/tokens',
      purpose: 'Administrator, operator and viewer roles; bcrypt passwords; server-side sessions; HttpOnly + SameSite=Strict cookies; CSRF and Origin checks; login rate limiting.',
      data: ['API tokens (hashed) with a scope: events, ingest, metrics, read'],
      docs: [docs('Security model', 'deployment/security')],
      note: 'No SSO and no per-environment permissions (see Limitations).',
    },
  },
  {
    id: 'notifier', title: 'Notifier', subtitle: 'channels · silences', icon: 'Bell', tone: 'amber', rect: { x: col.c3, y: row(2), w: W, h: H },
    details: {
      kind: 'domain/notify',
      purpose: 'Sends incident events (opened, escalated, resolved, reminder) to configured channels with severity, environment, rule and instance filters, escalation tiers, silences and maintenance windows.',
      data: ['Each event is sent once, also after a restart', 'Retries on network errors, 429 and 5xx; every attempt is recorded'],
      note: 'Messages never contain SQL text, connection strings, or credentials.',
      docs: [docs('Notifications', 'features/notifications')],
    },
  },
  {
    id: 'telemetry', title: 'Metrics export', subtitle: 'Prometheus metrics', icon: 'Rss', tone: 'amber', rect: { x: col.c3, y: row(3), w: W, h: H },
    details: {
      kind: 'domain/telemetry',
      purpose: 'Exports the monitored instances’ metrics from the live views of the instances this server collects.',
      data: ['GET /metrics/targets (token of scope metrics) in Prometheus format'],
      note: 'Exported counters are running totals of what LockLens observed; they restart at zero after a LockLens restart.',
      docs: [docs('Integrations', 'deployment/integrations')],
    },
  },
  {
    id: 'cluster', title: 'Cluster membership', subtitle: 'leases · LISTEN/NOTIFY', icon: 'Combine', tone: 'blue', rect: { x: col.c3, y: row(4), w: W, h: H },
    details: {
      kind: 'domain/cluster',
      purpose: 'Lets several servers share one store: heartbeats, target leases (45 s, renewed every 15 s sync), once-per-cluster job leases, and a message bus over PostgreSQL LISTEN/NOTIFY.',
      note: 'A crashed server’s targets move within about a minute, leaving a gap; around a takeover two servers can briefly collect the same target.',
      refs: ['backend/internal/domain/cluster/cluster.go'],
      docs: [docs('High availability', 'deployment/high-availability')],
    },
  },
  {
    id: 'jobs', title: 'Background jobs', subtitle: 'rollups · retention', icon: 'Repeat', tone: 'emerald', rect: { x: col.c3, y: row(5), w: W, h: H },
    details: {
      kind: 'domain/rollup, retention, baseline, optimizer, notify (singleton jobs)',
      purpose: 'One-minute and hourly metric rollups, five-minute statement rollups for baselines, hourly retention in small batches, optimizer runs, and notification reminders.',
    },
  },
  // --- Store ---------------------------------------------------------------------
  {
    id: 'store', title: 'PostgreSQL 14+ · TimescaleDB recommended', subtitle: 'metric_points · query_samples · activity_snapshots · incidents · findings · targets (encrypted)', icon: 'Database', tone: 'emerald', rect: { x: col.c1, y: 690, w: 732, h: 72 },
    details: {
      kind: 'Monitoring store (LOCKLENS_STORE_DSN)',
      purpose: 'History, rollups, findings, incidents with their own copy of the evidence, users, sessions, API tokens, and encrypted connection strings.',
      data: ['With TimescaleDB: hypertables partitioned by time, compressed after 24 h, expired by whole chunks', 'Migrations embedded in the binary, applied at startup under an advisory lock'],
      note: 'Must not be one of the monitored databases. It is a single PostgreSQL: make it highly available with your usual tooling.',
    },
  },
  // --- Presentation ---------------------------------------------------------------
  {
    id: 'ui', title: 'Web dashboard', subtitle: 'React · in your browser', icon: 'Monitor', tone: 'blue', rect: { x: col.out, y: 96, w: 282, h: H },
    details: {
      kind: 'web/ (React + TypeScript, TanStack Query, ECharts)',
      purpose: 'Fleet overview, instance dashboards, queries, sessions, blocking, replication, incidents, optimize, explorer and SQL editor, settings.',
      data: ['Data fetched with TanStack Query; server-sent events invalidate the relevant queries instead of polling everything'],
      docs: [docs('UI guide', 'getting-started/ui-guide')],
    },
  },
  {
    id: 'frontend', title: 'Frontend', subtitle: 'nginx · proxies /api/', icon: 'Server', tone: 'blue', rect: { x: col.out, y: 180, w: 282, h: H },
    details: {
      kind: 'locklens-frontend image',
      purpose: 'Serves the built UI and proxies /api/ (and /metrics/targets) to the backend, so the browser sees one origin.',
      data: ['Only the frontend is published; expose the backend to the frontend and Prometheus, not to browsers'],
      docs: [docs('Deployment', 'deployment')],
    },
  },
  // --- Alerts & integrations ------------------------------------------------------
  {
    id: 'channels', title: 'Slack · Webhook · Email', subtitle: 'notification channels', icon: 'Send', tone: 'amber', rect: { x: col.out, y: 336, w: 282, h: H },
    details: {
      kind: 'Destinations you configure',
      purpose: 'Slack incoming webhooks, any http(s) webhook with an optional HMAC-SHA256 signature, and SMTP email to up to 20 recipients.',
      docs: [docs('Notifications', 'features/notifications')],
    },
  },
  {
    id: 'alertmanager', title: 'Prometheus Alertmanager', subtitle: '/api/v2/alerts', icon: 'Megaphone', tone: 'amber', rect: { x: col.out, y: 420, w: 282, h: H },
    details: {
      kind: 'Notification channel of type Alertmanager',
      purpose: 'Posts incidents as alerts; Alertmanager routes then decide who is paged with your existing receivers. Open incidents are refreshed every 2 minutes.',
      docs: [docs('Alertmanager', 'deployment/integrations')],
    },
  },
  {
    id: 'prometheus', title: 'Prometheus', subtitle: 'scrapes /metrics/targets', icon: 'ChartLine', tone: 'amber', rect: { x: col.out, y: 504, w: 282, h: H },
    details: {
      kind: 'Pulled by your Prometheus',
      purpose: 'Every series carries target and environment labels. The repository ships alerting rules built on these metrics.',
      refs: ['deploy/observability/locklens-rules.yml'],
      docs: [docs('Integrations', 'deployment/integrations')],
    },
  },
];

export const EDGES: ArchEdge[] = [
  // Step 1 — connect
  { id: 'e-reg-man', from: 'registry', to: 'manager', kind: 'process', label: 'targets changed', opts: { from: 'b', to: 't' } },
  { id: 'e-man-tgt', from: 'manager', to: 't-statements', kind: 'collect', opts: { from: 'l', to: 'r' }, bidirectional: true, labelOffset: { x: 0, y: -14 } },
  // Step 2 — collect
  { id: 'e-man-col', from: 'manager', to: 'collectors', kind: 'process', label: 'schedule', opts: { from: 'b', to: 't' } },
  { id: 'e-t1', from: 't-sessions', to: 'collectors', kind: 'collect', opts: { from: 'r', to: 'l', toOffset: -18, via: [{ x: 300, y: 143 }, { x: 300, y: 293 }] } },
  { id: 'e-t2', from: 't-statements', to: 'collectors', kind: 'collect', opts: { from: 'r', to: 'l', fromOffset: 12, toOffset: -9, via: [{ x: 308, y: 239 }, { x: 308, y: 302 }] } },
  { id: 'e-t3', from: 't-counters', to: 'collectors', kind: 'collect', label: 'read-only SQL', labelOffset: { x: -2, y: -14 }, opts: { from: 'r', to: 'l' } },
  { id: 'e-t4', from: 't-replication', to: 'collectors', kind: 'collect', opts: { from: 'r', to: 'l', toOffset: 9, via: [{ x: 308, y: 395 }, { x: 308, y: 320 }] } },
  { id: 'e-t5', from: 't-catalog', to: 'collectors', kind: 'collect', opts: { from: 'r', to: 'l', toOffset: 18, via: [{ x: 300, y: 479 }, { x: 300, y: 329 }] } },
  { id: 'e-host', from: 'node-exporter', to: 'collectors', kind: 'collect', label: 'HTTP scrape', labelOffset: { x: 0, y: 30 }, opts: { from: 'r', to: 'b', toOffset: -80, via: [{ x: 316, y: 653 }, { x: 316, y: 354 }, { x: 384, y: 354 }] } },
  // Step 3 — process
  { id: 'e-col-delta', from: 'collectors', to: 'deltas', kind: 'process', opts: { from: 'b', to: 't', fromOffset: 30, toOffset: 30 } },
  { id: 'e-delta-live', from: 'deltas', to: 'live', kind: 'process', opts: { from: 'b', to: 't' } },
  { id: 'e-col-graph', from: 'collectors', to: 'graph', kind: 'process', opts: { from: 'r', to: 'l', fromOffset: -12, via: [{ x: 588, y: 299 }, { x: 588, y: 143 }] } },
  { id: 'e-live-rules', from: 'live', to: 'rules', kind: 'process', opts: { from: 'r', to: 'l', via: [{ x: 596, y: 479 }, { x: 596, y: 227 }] }, labelOffset: { x: 0, y: 60 } },
  { id: 'e-graph-rules', from: 'graph', to: 'rules', kind: 'process', opts: { from: 'b', to: 't' } },
  { id: 'e-rules-rec', from: 'rules', to: 'recorder', kind: 'process', label: 'trigger findings', opts: { from: 'b', to: 't' }, labelOffset: { x: 0, y: 0 } },
  { id: 'e-col-changes', from: 'collectors', to: 'changes', kind: 'process', opts: { from: 'r', to: 'l', fromOffset: 12, via: [{ x: 580, y: 323 }, { x: 580, y: 563 }] } },
  // Step 4 — store
  { id: 'e-delta-writer', from: 'deltas', to: 'writer', kind: 'store', opts: { from: 'l', to: 'l', via: [{ x: 342, y: 395 }, { x: 342, y: 563 }] } },
  { id: 'e-writer-store', from: 'writer', to: 'store', kind: 'store', label: 'ordered writes', opts: { from: 'b', to: 't', toOffset: -256 } },
  { id: 'e-rec-store', from: 'recorder', to: 'store', kind: 'store', opts: { from: 'r', to: 't', via: [{ x: 848, y: 311 }, { x: 848, y: 690 }] } },
  { id: 'e-jobs-store', from: 'jobs', to: 'store', kind: 'store', label: 'rollups · retention', opts: { from: 'b', to: 't', toOffset: 210 }, bidirectional: true },
  // Step 5 — visualise
  { id: 'e-ui-front', from: 'ui', to: 'frontend', kind: 'api', label: 'HTTPS · one origin', opts: { from: 'b', to: 't' }, bidirectional: true },
  { id: 'e-front-api', from: 'frontend', to: 'api', kind: 'api', label: '/api/ · SSE', opts: { from: 'l', to: 'r', via: [{ x: 1130, y: 209 }, { x: 1130, y: 143 }] }, bidirectional: true },
  { id: 'e-api-store', from: 'store', to: 'api', kind: 'store', opts: { from: 'r', to: 'r', via: [{ x: 1100, y: 726 }, { x: 1100, y: 154 }], toOffset: 11 } },
  { id: 'e-auth-api', from: 'auth', to: 'api', kind: 'process', opts: { from: 't', to: 'b' }, bidirectional: true },
  // Step 6 — detect & notify
  { id: 'e-rec-notify', from: 'recorder', to: 'notifier', kind: 'alert', opts: { from: 'r', to: 'l', fromOffset: -10 } },
  { id: 'e-notify-chan', from: 'notifier', to: 'channels', kind: 'alert', opts: { from: 'r', to: 'l' } },
  { id: 'e-notify-am', from: 'notifier', to: 'alertmanager', kind: 'alert', opts: { from: 'r', to: 'l', fromOffset: 12 } },
  { id: 'e-tel-prom', from: 'telemetry', to: 'prometheus', kind: 'alert', label: 'scraped', labelOffset: { x: 6, y: 6 }, opts: { from: 'r', to: 'l' } },
  { id: 'e-agent-api', from: 'log-agent', to: 'api', kind: 'alert', label: 'log events (token)', labelOffset: { x: -300, y: 0 }, opts: { from: 'b', to: 'r', toOffset: -14, via: [{ x: 154, y: 818 }, { x: 1120, y: 818 }, { x: 1120, y: 129 }] } },
];

export interface ArchStep {
  id: string;
  title: string;
  summary: string;
  detail: string;
  nodes: string[];
  edges: string[];
}

export const STEPS: ArchStep[] = [
  {
    id: 'connect',
    title: 'Connect',
    summary: 'A PostgreSQL target is added to LockLens.',
    detail: 'An administrator pastes a connection string. The target registry encrypts it (AES-256-GCM), the manager starts a worker with a small read-only pool, and capabilities are detected: version, standby, pg_read_all_stats, pg_stat_statements.',
    nodes: ['registry', 'manager', 't-statements', 't-sessions', 't-counters', 't-replication', 't-catalog'],
    edges: ['e-reg-man', 'e-man-tgt'],
  },
  {
    id: 'collect',
    title: 'Collect',
    summary: 'Read-only queries periodically read PostgreSQL statistics.',
    detail: 'Each worker runs its collectors one at a time on their own schedules, under a global concurrency limit. Every collection runs in a READ ONLY transaction with statement, lock and idle timeouts. node_exporter is scraped only if configured.',
    nodes: ['manager', 'collectors', 't-sessions', 't-statements', 't-counters', 't-replication', 't-catalog', 'node-exporter'],
    edges: ['e-man-col', 'e-t1', 'e-t2', 'e-t3', 'e-t4', 'e-t5', 'e-host'],
  },
  {
    id: 'process',
    title: 'Process',
    summary: 'Snapshots, counter deltas and blocking dependencies are analysed.',
    detail: 'Counters become rates (unknown is stored as a gap, never zero). Activity snapshots become a blocker → waiter graph from pg_blocking_pids(). After each activity collection the rules engine evaluates the in-memory history; trigger findings reach the incident recorder. Settings and schema are diffed into the change timeline.',
    nodes: ['collectors', 'deltas', 'live', 'graph', 'rules', 'recorder', 'changes', 'insight'],
    edges: ['e-col-delta', 'e-delta-live', 'e-col-graph', 'e-live-rules', 'e-graph-rules', 'e-rules-rec', 'e-col-changes'],
  },
  {
    id: 'store',
    title: 'Store',
    summary: 'Monitoring data and incident evidence go to the separate monitoring store.',
    detail: 'Collectors never write directly: batches go through one writer with a bounded queue. The recorder stores incidents with their own copy of the evidence. Background jobs build rollups (the source of query baselines) and apply retention.',
    nodes: ['deltas', 'writer', 'store', 'recorder', 'jobs', 'insight', 'optimizer'],
    edges: ['e-delta-writer', 'e-writer-store', 'e-rec-store', 'e-jobs-store'],
  },
  {
    id: 'visualize',
    title: 'Visualise',
    summary: 'The dashboard asks the backend for current and historical data.',
    detail: 'The browser talks only to the frontend, which proxies /api/ to the backend. The API serves live values from memory and history from the store, checks the session and role on every request, and pushes server-sent events so the UI refreshes only what changed.',
    nodes: ['ui', 'frontend', 'api', 'auth', 'store', 'live'],
    edges: ['e-ui-front', 'e-front-api', 'e-api-store', 'e-auth-api'],
  },
  {
    id: 'notify',
    title: 'Detect & notify',
    summary: 'Rules open incidents and notifications go to supported destinations.',
    detail: 'Incident events (opened, escalated, resolved, reminders) go to Slack, webhooks, email or Alertmanager, filtered by severity, environment, rule and instance, and held back by silences and maintenance windows. Metrics are exported to Prometheus (pulled). The optional log agent ships server log events in.',
    nodes: ['recorder', 'notifier', 'channels', 'alertmanager', 'telemetry', 'prometheus', 'log-agent', 'api'],
    edges: ['e-rec-notify', 'e-notify-chan', 'e-notify-am', 'e-tel-prom', 'e-agent-api'],
  },
];
