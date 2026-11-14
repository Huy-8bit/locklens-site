// Semantic flow types shared by every diagram. Colour is never the only cue:
// each kind also has its own dash pattern and a label in the legend.

export type FlowKind = 'app' | 'collect' | 'process' | 'store' | 'api' | 'alert' | 'repl' | 'lease';

export interface FlowStyle {
  color: string;
  dash?: string;
  width: number;
  label: string;
  description: string;
}

export const FLOWS: Record<FlowKind, FlowStyle> = {
  app: {
    color: 'var(--flow-app, #8392a8)',
    width: 1.6,
    label: 'Application traffic',
    description: 'Requests and SQL from your services. Never passes through LockLens.',
  },
  collect: {
    color: 'var(--flow-monitor, #087a9e)',
    dash: '7 5',
    width: 1.7,
    label: 'Read-only collection',
    description: 'LockLens’ own connections reading PostgreSQL statistics views on a schedule.',
  },
  process: {
    color: '#818cf8',
    width: 1.5,
    label: 'In-process data flow',
    description: 'Calls inside the single locklens server process.',
  },
  store: {
    color: 'var(--flow-store, #147c77)',
    width: 1.8,
    label: 'Monitoring store I/O',
    description: 'Writes and reads of LockLens’ own PostgreSQL / TimescaleDB database.',
  },
  api: {
    color: 'var(--flow-api, #3478f6)',
    width: 1.7,
    label: 'UI & API',
    description: 'Browser ↔ frontend ↔ backend over HTTP (REST and server-sent events).',
  },
  alert: {
    color: 'var(--flow-alert, #aa7309)',
    dash: '9 3 2 3',
    width: 1.7,
    label: 'Alerts & telemetry',
    description: 'Notifications and metric exports leaving LockLens.',
  },
  repl: {
    color: 'var(--flow-repl, #7962cc)',
    dash: '2 4',
    width: 2,
    label: 'PostgreSQL replication',
    description: 'WAL streaming between a primary and its standbys.',
  },
  lease: {
    color: '#f472b6',
    dash: '3 3',
    width: 1.4,
    label: 'Lease / coordination',
    description: 'Servers renewing target leases in the shared store.',
  },
};
