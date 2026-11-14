# Production topology

Where LockLens sits in a real environment with many services and several
PostgreSQL clusters, and which network paths it does and does not use. This
guide summarises [architecture](architecture.md), [deployment](deployment.md),
[collectors](collectors.md), and [security](security.md); those pages are the
reference.

## LockLens is out of band

Application traffic never passes through LockLens. Clients reach your
services through your usual load balancers and gateways, and services reach
PostgreSQL directly or through a connection pooler. LockLens opens its **own**
connections to each monitored server with a read-only role and reads
PostgreSQL's statistics views on a schedule.

```text
Application path (unchanged)
  clients ─► load balancer / API gateway ─► services ─► pooler (optional) ─► PostgreSQL

Monitoring path (separate)
  PostgreSQL ◄── read-only queries ── locklens server ──► monitoring store
                                            │
                                            ├──► web UI (through the frontend)
                                            └──► Slack · webhooks · email · Alertmanager · Prometheus
```

Consequences:

- Removing LockLens, or LockLens being down, does not affect application
  requests. It leaves a gap in LockLens' own history.
- LockLens sees the **database side** of a problem: sessions, waits, locks,
  blocking chains, statement statistics, replication. It does not trace
  application requests, service-to-service calls, or network traffic.
- Observation is not free: each collection runs catalog queries, and
  `pg_blocking_pids()` briefly takes the lock manager's shared state once per
  waiting backend. See [limitations](limitations.md#overhead) and the
  [collector time budget](collectors.md#collector-time-budget).

## What connects to what

| From | To | Purpose | Notes |
| --- | --- | --- | --- |
| `locklens server` | Each monitored PostgreSQL server (primary or standby) | Read-only collection | A pool of 1–5 connections (default 2) per target, `READ ONLY` transactions, `application_name = locklens`, timeouts on every statement |
| `locklens server` | Monitoring store (PostgreSQL 14+, TimescaleDB recommended) | History, incidents, users, encrypted connection strings | Must not be one of the monitored databases |
| `locklens server` | node_exporter on a database host (optional) | Host CPU, memory, disk, network | Only when configured per target |
| Browser | Frontend (nginx) | UI and `/api/` on one origin | The frontend proxies `/api/` to the backend |
| `locklens server` | Slack, webhooks, SMTP, Alertmanager | Incident notifications | Configured as notification channels |
| Prometheus | Frontend or backend `/metrics/targets` | Metrics of the monitored instances | Needs an API token of scope `metrics` |
| `locklens agent` (optional, on the DB host) | `locklens server` `/api/v1/ingest/logs` | Server log events | Never connects to PostgreSQL |
| Deploy pipeline (optional) | `POST /api/v1/changes` | Report deploys and migrations | Token of scope `events` |

LockLens needs no access to your application services, load balancers, or
connection poolers. Monitoring through a pooler is not required: point
LockLens directly at each PostgreSQL server, because `pg_stat_activity` and
`pg_locks` describe the server LockLens is connected to.

## One target per PostgreSQL server

`pg_stat_activity` and `pg_locks` are cluster-wide, so one connection observes
every database of that server. Replicas and other clusters are separate
targets ([limitations](limitations.md#visibility)). In a typical production
fleet:

- every primary is a target;
- every streaming standby you care about is a target too (standbys can reuse
  the roles of their primary, see [quickstart](quickstart.md));
- independent clusters (for example an orders cluster and a payments
  cluster) are independent targets, grouped by **environment** (production,
  staging, …) in the UI.

Tables, indexes, and optimizer recommendations can come from several
databases of a target with `database_scope` (at most 20); see
[architecture](architecture.md#several-databases-per-instance).

## Single instance

The smallest deployment is one backend, one frontend, and one store on a
single host (`make up`, see [deployment](deployment.md#docker-compose)).
Add the database in **Settings → Instances → Add instance** with a role that
has `pg_read_all_stats`.

## Production cluster

Add the primary and each standby as targets. LockLens shows the replication
topology with replay lag, retained WAL per slot, and standby receive/replay
state; see [replication monitoring](replication-monitoring.md). The
application keeps using its own pooler and read/write split; LockLens is not
part of it.

## Large fleets

One `locklens server` runs one worker per target under a global concurrency
limit (`LOCKLENS_MAX_CONCURRENT_COLLECTIONS`, default 4). The project has been
tested locally with up to 20 targets on one machine; larger fleets have not
been measured ([limitations](limitations.md#server-and-monitoring)). Storage
grows with the number of targets and their intervals
([storage](storage-and-retention.md)).

For availability, several servers can share one store and split the targets
by leases; see [high availability](high-availability.md).

## Network and security boundaries

- Expose only the **frontend** to people. The backend needs to be reachable by
  the frontend (and by Prometheus for `/metrics`), not by browsers.
- Terminate TLS in front of the frontend and set `LOCKLENS_COOKIE_SECURE=true`.
- Allow the backend to reach each monitored server's PostgreSQL port, the
  store, and your notification destinations. Use `sslmode=verify-full` over
  untrusted networks.
- Connection strings are encrypted with `LOCKLENS_MASTER_KEY` (AES-256-GCM)
  and never returned by the API.

Details: [security](security.md), [deployment](deployment.md#tls-and-other-proxies).
