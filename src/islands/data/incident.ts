// Deterministic, illustrative incident scenario. Behaviour follows the
// documented rules: blocking.long_chain fires once a root blocker has blocked
// ≥ 1 session for ≥ 30 s across ≥ 3 consecutive samples (docs/rules.md);
// blocked sessions trigger adaptive sampling (activity every 3 s,
// docs/collectors.md); an incident resolves after 3 consecutive samples
// without the condition (docs/incidents.md). Application latency is NOT
// something LockLens measures: it is shown only as the illustrative
// consequence of database blocking.

export type SessionState = 'active' | 'idle' | 'waiting';

export interface Session {
  pid: number;
  app: string;
  query: string;
  state: SessionState;
  detail: string; // e.g. "tx 48 s", "Lock: transactionid · 21 s"
  blockedBy?: number;
}

export type ServiceId = 'checkout' | 'inventory' | 'reporting' | 'batch';
export interface ServiceStatus {
  status: 'ok' | 'slow' | 'stalled';
  latency: string;
}

export interface TimelineEvent {
  time: string;
  kind: 'pre_trigger' | 'trigger' | 'blocking_snapshot' | 'sessions' | 'load' | 'sample' | 'finding' | 'post_trigger' | 'resolved';
  text: string;
}

export interface Scene {
  id: string;
  title: string;
  time: string;
  narration: string;
  sees: string;
  consequence: string;
  sessions: Session[];
  services: Record<ServiceId, ServiceStatus>;
  sampling: string;
  incident: null | { id: number; title: string; state: 'open' | 'resolved'; severity: 'warning'; opened: string; duration: string };
  timeline: TimelineEvent[];
  /** Index into SAMPLES: chart shows samples up to and including this one. */
  sampleIndex: number;
  hypotheses?: string[];
  nextChecks?: string[];
}

const S = {
  reader: (state: SessionState = 'active', detail = '3 ms'): Session => ({ pid: 4120, app: 'checkout-svc', query: 'SELECT … FROM orders WHERE id = $1', state, detail }),
  batch: (detail: string, state: SessionState = 'active'): Session => ({ pid: 4127, app: 'reprice-job', query: 'UPDATE inventory SET price = price * $1 WHERE category = $2', state, detail }),
  report: (): Session => ({ pid: 4131, app: 'reporting-svc', query: 'SELECT sum(total) FROM orders WHERE created_at > $1', state: 'active', detail: '1.2 s' }),
  co1: (state: SessionState, detail: string, blockedBy?: number): Session => ({ pid: 4133, app: 'checkout-svc', query: 'UPDATE inventory SET reserved = reserved + 1 WHERE sku = $1', state, detail, blockedBy }),
  co2: (state: SessionState, detail: string, blockedBy?: number): Session => ({ pid: 4139, app: 'checkout-svc', query: 'UPDATE inventory SET reserved = reserved + 1 WHERE sku = $1', state, detail, blockedBy }),
  inv: (state: SessionState, detail: string, blockedBy?: number): Session => ({ pid: 4142, app: 'inventory-svc', query: 'UPDATE inventory SET stock = stock - $1 WHERE sku = $2', state, detail, blockedBy }),
};

const ok = (latency: string): ServiceStatus => ({ status: 'ok', latency });

/** Activity samples LockLens takes: 10 s interval, 3 s while sessions are blocked. */
export const SAMPLES: { t: number; label: string; blocked: number; maxWait: number }[] = (() => {
  const out: { t: number; label: string; blocked: number; maxWait: number }[] = [];
  const push = (t: number, blocked: number, maxWait: number) => {
    const total = 80 + t; // seconds after 14:00:00
    const m = Math.floor(total / 60);
    const s = total % 60;
    out.push({ t, label: `14:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, blocked, maxWait });
  };
  // t = seconds after 14:01:20
  for (let t = 0; t <= 40; t += 10) push(t, 0, 0); // 14:01:20 … 14:02:00
  push(50, 1, 2); // 14:02:10 first blocked sample → burst
  for (let t = 53; t <= 155; t += 3) push(t, t < 59 ? 1 : t < 62 ? 2 : 3, t - 48);
  for (let t = 158; t <= 164; t += 3) push(t, 0, 0); // three clear samples → resolved
  return out;
})();
const idx = (label: string) => SAMPLES.findIndex((s) => s.label === label);

export const SCENES: Scene[] = [
  {
    id: 'healthy',
    title: 'Healthy system',
    time: '14:02:00',
    narration: 'Requests flow through the gateway to the services, which run short statements on orders-db. A reprice job has had a transaction open for 38 s, but nobody needs its rows yet.',
    sees: 'Sessions, states and transaction ages from pg_stat_activity every 10 s. No blocking edges from pg_blocking_pids().',
    consequence: 'Every path responds normally.',
    sessions: [S.reader(), S.batch('tx 38 s'), S.report(), S.co1('idle', 'idle'), S.co2('idle', 'idle'), S.inv('idle', 'idle')],
    services: { checkout: ok('42 ms'), inventory: ok('31 ms'), reporting: ok('1.3 s'), batch: ok('running') },
    sampling: 'activity every 10 s',
    incident: null,
    timeline: [],
    sampleIndex: idx('14:02:00'),
  },
  {
    id: 'begins',
    title: 'The problem begins',
    time: '14:02:10',
    narration: 'checkout-svc tries to reserve an item whose row the reprice job already updated. Its UPDATE has to wait until the job’s transaction commits or rolls back.',
    sees: 'pid 4133 waits for a lock (wait event Lock: transactionid); pg_blocking_pids(4133) = {4127}. Blocked sessions make LockLens sample this target every 3 s.',
    consequence: 'Illustrative: checkout requests that touch this item start to hang.',
    sessions: [S.reader(), S.batch('tx 48 s'), S.report(), S.co1('waiting', 'Lock · 2 s', 4127), S.co2('idle', 'idle'), S.inv('idle', 'idle')],
    services: { checkout: { status: 'slow', latency: '1.9 s' }, inventory: ok('33 ms'), reporting: ok('1.2 s'), batch: ok('running') },
    sampling: 'burst: activity every 3 s',
    incident: null,
    timeline: [],
    sampleIndex: idx('14:02:10'),
  },
  {
    id: 'expands',
    title: 'The blocking chain expands',
    time: '14:02:31',
    narration: 'A second checkout request queues behind the first on the same row, and inventory-svc waits on a row the job holds. The job keeps running; nothing waits for it to finish.',
    sees: 'Graph: 4127 → 4133 → 4139 and 4127 → 4142. Root blocker 4127 blocks 2 sessions directly, 3 in total. Longest lock wait 23 s.',
    consequence: 'Illustrative: checkout and inventory paths stall; reporting is unaffected because plain SELECTs do not conflict with row locks.',
    sessions: [S.reader(), S.batch('tx 69 s'), S.report(), S.co1('waiting', 'Lock · 23 s', 4127), S.co2('waiting', 'Lock · 9 s', 4133), S.inv('waiting', 'Lock · 12 s', 4127)],
    services: { checkout: { status: 'stalled', latency: '> 20 s' }, inventory: { status: 'slow', latency: '12 s' }, reporting: ok('1.2 s'), batch: ok('running') },
    sampling: 'burst: activity every 3 s',
    incident: null,
    timeline: [],
    sampleIndex: idx('14:02:31'),
  },
  {
    id: 'detects',
    title: 'LockLens detects evidence',
    time: '14:02:40',
    narration: 'The same root blocker has now blocked sessions for 30 s across more than 3 consecutive samples, so the blocking.long_chain rule fires and the incident recorder opens an incident.',
    sees: 'Finding blocking.long_chain (warning): “Blocking chain rooted at pid 4127 persists (3 blocked)”. The recorder keeps the samples from before the trigger, the blocking graph, and the sessions at that moment.',
    consequence: 'If a notification channel matches the rule and severity, Slack, a webhook, email or Alertmanager receive “opened”.',
    sessions: [S.reader(), S.batch('tx 78 s'), S.report(), S.co1('waiting', 'Lock · 32 s', 4127), S.co2('waiting', 'Lock · 18 s', 4133), S.inv('waiting', 'Lock · 21 s', 4127)],
    services: { checkout: { status: 'stalled', latency: '> 30 s' }, inventory: { status: 'stalled', latency: '20 s' }, reporting: ok('1.2 s'), batch: ok('running') },
    sampling: 'burst: activity every 3 s',
    incident: { id: 42, title: 'Blocking chain rooted at pid 4127 persists (3 blocked)', state: 'open', severity: 'warning', opened: '14:02:40', duration: '0 s' },
    timeline: [
      { time: '14:01:20', kind: 'pre_trigger', text: 'Samples from before the trigger (in-memory buffer)' },
      { time: '14:02:40', kind: 'trigger', text: 'blocking.long_chain: pid 4127 blocked 3 session(s) for 30 s across 11 samples' },
      { time: '14:02:40', kind: 'blocking_snapshot', text: 'Blocking graph stored: 1 root, 3 waiting, 2 levels' },
      { time: '14:02:40', kind: 'sessions', text: '6 client sessions recorded, blockers first' },
      { time: '14:02:40', kind: 'load', text: 'Database load in the 5 min before: wait class Lock rising' },
    ],
    sampleIndex: idx('14:02:40'),
  },
  {
    id: 'investigate',
    title: 'Incident investigation',
    time: '14:03:19',
    narration: 'An engineer opens incident #42: what happened, which session is the root, what the server was busy with, and a timeline of every recorded event — the evidence, not a verdict.',
    sees: 'Root blocker 4127 (reprice-job), active, transaction open 117 s, running a bulk UPDATE on inventory. Three waiters, longest wait 71 s. Load by wait class is dominated by Lock.',
    consequence: 'LockLens never cancels or terminates a session. A person decides whether to wait, stop the job, or change how it commits.',
    sessions: [S.reader(), S.batch('tx 117 s'), S.report(), S.co1('waiting', 'Lock · 71 s', 4127), S.co2('waiting', 'Lock · 57 s', 4133), S.inv('waiting', 'Lock · 60 s', 4127)],
    services: { checkout: { status: 'stalled', latency: 'timeouts' }, inventory: { status: 'stalled', latency: 'timeouts' }, reporting: ok('1.2 s'), batch: ok('running') },
    sampling: 'burst: activity every 3 s',
    incident: { id: 42, title: 'Blocking chain rooted at pid 4127 persists (3 blocked)', state: 'open', severity: 'warning', opened: '14:02:40', duration: '39 s' },
    timeline: [
      { time: '14:01:20', kind: 'pre_trigger', text: 'Samples from before the trigger (in-memory buffer)' },
      { time: '14:02:40', kind: 'trigger', text: 'blocking.long_chain: pid 4127 blocked 3 session(s) for 30 s across 11 samples' },
      { time: '14:02:40', kind: 'blocking_snapshot', text: 'Blocking graph stored: 1 root, 3 waiting, 2 levels' },
      { time: '14:02:40', kind: 'sessions', text: '6 client sessions recorded, blockers first' },
      { time: '14:02:40', kind: 'load', text: 'Database load in the 5 min before: wait class Lock rising' },
      { time: '14:03:19', kind: 'sample', text: 'Still 3 blocked · longest lock wait 71 s' },
    ],
    hypotheses: ['A long transaction holds row locks that other statements need', 'The job updates many rows in one transaction instead of smaller batches'],
    nextChecks: ['What is the client of pid 4127 doing, and when will it commit?', 'Do the waiting statements touch the same rows (same sku / category)?'],
    sampleIndex: idx('14:03:19'),
  },
  {
    id: 'recovery',
    title: 'Recovery',
    time: '14:04:04',
    narration: 'The reprice job commits. The waiting UPDATEs acquire their locks and finish; the blocked requests complete. After three consecutive samples without the condition, the incident resolves.',
    sees: 'No blocking edges at 14:03:58, 14:04:01 and 14:04:04 → resolved (condition cleared). The incident keeps its own copy of the evidence and can be exported as JSON or a standalone HTML report.',
    consequence: 'Illustrative: checkout and inventory latency return to normal.',
    sessions: [S.reader(), S.batch('committed', 'idle'), S.report(), S.co1('active', '4 ms'), S.co2('active', '3 ms'), S.inv('active', '5 ms')],
    services: { checkout: ok('48 ms'), inventory: ok('35 ms'), reporting: ok('1.2 s'), batch: ok('done') },
    sampling: 'burst ends after 10 min · then every 10 s',
    incident: { id: 42, title: 'Blocking chain rooted at pid 4127 persists (3 blocked)', state: 'resolved', severity: 'warning', opened: '14:02:40', duration: '1m 24s' },
    timeline: [
      { time: '14:01:20', kind: 'pre_trigger', text: 'Samples from before the trigger (in-memory buffer)' },
      { time: '14:02:40', kind: 'trigger', text: 'blocking.long_chain: pid 4127 blocked 3 session(s) for 30 s across 11 samples' },
      { time: '14:02:40', kind: 'blocking_snapshot', text: 'Blocking graph stored: 1 root, 3 waiting, 2 levels' },
      { time: '14:02:40', kind: 'sessions', text: '6 client sessions recorded, blockers first' },
      { time: '14:02:40', kind: 'load', text: 'Database load in the 5 min before: wait class Lock rising' },
      { time: '14:03:19', kind: 'sample', text: 'Still 3 blocked · longest lock wait 71 s' },
      { time: '14:03:58', kind: 'post_trigger', text: 'Condition cleared: no blocked sessions' },
      { time: '14:04:04', kind: 'resolved', text: 'Resolved after 3 samples without the condition' },
    ],
    hypotheses: ['A long transaction holds row locks that other statements need', 'The job updates many rows in one transaction instead of smaller batches'],
    nextChecks: ['What is the client of pid 4127 doing, and when will it commit?', 'Do the waiting statements touch the same rows (same sku / category)?'],
    sampleIndex: SAMPLES.length - 1,
  },
];

export const SERVICE_LABELS: Record<ServiceId, string> = {
  checkout: 'Checkout service',
  inventory: 'Inventory service',
  reporting: 'Reporting service',
  batch: 'Reprice job',
};
export const SERVICE_PIDS: Record<ServiceId, number[]> = {
  checkout: [4120, 4133, 4139],
  inventory: [4142],
  reporting: [4131],
  batch: [4127],
};
