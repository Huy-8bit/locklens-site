# High availability

Several `locklens server` processes can share one monitoring store so that
collection continues when one of them stops. This page summarises the model
described in [architecture](architecture.md#several-servers) and
[deployment](deployment.md#several-servers), and its limits from
[limitations](limitations.md#server-and-monitoring).

## How servers share the work

- Each server registers in the `servers` table with a heartbeat.
- On every sync (15 s), a server renews its **leases** on targets
  (`target:<id>`, 45 s) up to an even share, releases the rest, and takes
  free or expired leases.
- A target is collected by the server holding its lease. Once-per-cluster
  jobs (retention, rollups, baselines, optimizer, notification reminders) hold
  a `job:<name>` lease, so each runs on one server.
- Browser events, "collect now" requests, and settings changes travel between
  servers over PostgreSQL `LISTEN/NOTIFY`.
- While it is not alone, the collecting server publishes each target's live
  view to `live_state` every 5 seconds, so any server can answer API requests
  for any target.

```text
             ┌──────────────────────── frontend / load balancer ────────────────────────┐
             ▼                                    ▼                                     ▼
     locklens server A                     locklens server B                    locklens server C
  leases: orders-primary,             leases: payments-primary,             leases: reporting-db,
          orders-replica-1                    payments-replica                      orders-replica-2
             │                                    │                                     │
             └──────────── one monitoring store (servers, leases, live_state, history) ─┘
```

## What happens when a server stops

| Event | Effect |
| --- | --- |
| A server shuts down cleanly | It releases its leases; other servers take its targets on their next sync |
| A server crashes | Its leases expire (45 s); its targets move within about a minute. That time is a **gap** in their history |
| Around a takeover | For a moment, two servers can collect the same target |
| After a takeover | The new server reattaches open incidents and records `recorder_restarted`. The in-memory pre-trigger buffer and rule history of the old server are lost |

Collection is therefore **not** exactly-once and failover is **not**
seamless: expect a short gap and, rarely, a brief overlap.

## Deploying several servers

Run two or more backends with the same `LOCKLENS_STORE_DSN` and
`LOCKLENS_MASTER_KEY` behind the frontend or any load balancer. Give each a
distinct `LOCKLENS_SERVER_ID` for stable names in **Settings → Data and
storage**. Use sticky sessions if people use the SQL workspace: a running
statement can be cancelled only on the server that runs it.

## Limits to plan for

- The **monitoring store** is a single PostgreSQL database. Make it highly
  available with your usual PostgreSQL tooling; LockLens does not.
- Login rate limiting is per server.
- Messages between servers larger than about 8 KB are not forwarded.
- Prometheus: each server exports the instances it collects, so scrape every
  server. Exported counters restart from zero after a takeover
  ([integrations](integrations.md#prometheus)).
