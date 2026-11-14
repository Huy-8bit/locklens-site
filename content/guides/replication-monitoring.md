# Replication monitoring

LockLens reads PostgreSQL's replication views on each monitored server and
shows the replication topology with replay lag, replication slots and the WAL
they retain, and the receive/replay state of standbys. This page gathers what
[collectors](collectors.md), [rules](rules.md), and
[integrations](integrations.md) say about replication.

## What is collected

The `replication` collector runs every `max(interval, 30 s)` (every 10 s while
a target is in a burst; see [adaptive sampling](collectors.md#adaptive-sampling)):

| Source | On | Produces |
| --- | --- | --- |
| `pg_stat_replication` | Primary | Connected replicas and their lag |
| `pg_replication_slots` | Primary | Slots, whether they are active, retained WAL |
| `pg_stat_wal_receiver`, recovery functions | Standby | Receive and replay state |

Metrics include `replication.replicas`, `replication.replay_lag_bytes{replica}`,
`replication.max_replay_lag_bytes`, `slots.retained_bytes{slot}`,
`slots.max_retained_bytes`, `standby.replay_delay_bytes`, and the WAL rates
`wal.bytes.per_s` (primary) and `wal.received_bytes.per_s` (standby). See
[collectors](collectors.md#metrics).

## Monitoring primaries and standbys

Each PostgreSQL server is its own target. Add the primary and each standby you
want to watch; standbys can reuse the roles created on their primary. The
`changes` collector reads `pg_is_in_recovery()` every minute, so promotions
and demotions appear on the [change timeline](collectors.md#change-detection).

## Rules

| Rule | Fires when | Default mode |
| --- | --- | --- |
| `replication.replica_lag` | A replica's replay lag is ≥ 64 MiB for 2 consecutive samples (on a standby: received but not yet replayed WAL) | Opens incidents |
| `replication.slot_retained_wal` | A slot keeps ≥ 1 GiB of WAL; critical when `wal_status` is `unreserved` or `lost` | Opens incidents (trigger rule) |
| `wal.archiver_failures` | WAL archiving is failing | Opens incidents |

Thresholds and modes can be overridden per environment and per instance; see
[rules](rules.md#modes-and-overrides).

## Exported metrics

`locklens_pg_replicas`, `locklens_pg_replica_replay_lag_bytes`,
`locklens_pg_replication_slot_retained_bytes`, and
`locklens_pg_standby_replay_delay_bytes` are available to Prometheus through
`/metrics/targets`; see [integrations](integrations.md#metrics).

## Limits

- Replication state is sampled. Brief lag between samples is not seen
  ([limitations](limitations.md#server-and-monitoring)).
- Time-based lag fields are shown as evidence only when PostgreSQL provides
  them; they are empty when the primary is idle.
- LockLens never performs failover, promotion, or slot maintenance.
