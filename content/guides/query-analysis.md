# Query analysis

Use the **Queries** page to identify which statements consume execution time, compare two equal time windows, and check whether the data is complete. LockLens reads these statistics from PostgreSQL’s `pg_stat_statements` extension.

## Requirements

Complete all three prerequisites on the monitored server:

1. Add `pg_stat_statements` to `shared_preload_libraries`, then restart PostgreSQL.
2. Run `CREATE EXTENSION pg_stat_statements;` in the database that LockLens connects to.
3. Give the monitoring role permission to read statement statistics. `pg_read_all_stats` lets it see every user’s statements.

Without the required privileges, other users’ rows have no query ID. LockLens counts these as hidden entries in the coverage information.

If a prerequisite is missing, the statements collector stops and displays the reason. Workload rules report **insufficient data**; LockLens does not estimate missing statistics.

## Query identity

LockLens uses the following fields to identify a statement:

```text
(target, server major version, dbid, userid, toplevel, queryid)
```

The same SQL executed by different users or in different databases has separate identities. The server’s major version is also part of the key because query IDs are not stable across major PostgreSQL versions.

The API returns query IDs as **strings** to preserve their full 64-bit signed integer precision in JavaScript.

## Deltas between collections

By default, the collector reads cumulative counters every **15 seconds**. Set `LOCKLENS_STATEMENTS_INTERVAL` to change this interval.

For each changed statement, LockLens stores the difference since the previous collection: calls, execution time, rows, shared blocks hit and read, temporary blocks written, and WAL bytes. Mean execution time is derived from these values.

| Collection event | How LockLens handles it |
| --- | --- |
| First collection after startup | Establishes a baseline. No delta is recorded. |
| Statistics reset | Uses the current counters as deltas and marks the collection as a reset. The reset is detected from `pg_stat_statements_info.stats_reset`. |
| New statement | Uses its current counters as deltas because it appeared after the previous collection. |
| Counter decreases | Treats the entry as evicted and re-created; uses its current counters as deltas. |
| Entries evicted | Reports the lost entries as `evicted_entries`, using changes in `pg_stat_statements_info.dealloc`. Their interval counts cannot be recovered. |
| More than 2,000 changed entries | Stores the 2,000 largest execution-time deltas and counts the remaining entries as truncated. |

Window totals are the sum of stored deltas. They remain valid across resets and evictions, except for the losses reported in coverage.

Statement text is fetched only for identities not seen before. See [Statement text collection](collectors.md#statement-texts).

## Coverage

Coverage describes how much of the selected window has usable observations. The Queries page shows it beside the results.

| Field | Meaning |
| --- | --- |
| `window_seconds` | Total duration of the selected window. |
| `covered_seconds` | Duration backed by collections. Gaps, restarts, and the initial baseline reduce coverage. |
| `collections` | Number of collections in the window. |
| `resets` | Statistics resets observed during collection. |
| `evicted_entries` | Entries lost through eviction. |
| `hidden_entries_max` | Maximum number of entries hidden by insufficient permissions. |

**Partial coverage stays partial.** LockLens labels short or incomplete windows and never extrapolates their totals.

## Window comparison

Enable **Compare with previous window** to compare each statement with the preceding window of equal length. In the API, use `compare=true`.

| Ratio | Calculation |
| --- | --- |
| `calls_ratio` | Current calls ÷ previous calls |
| `load_ratio` | Current total execution time ÷ previous total execution time |
| `mean_ratio` | Current mean execution time ÷ previous mean execution time |

Comparison flags use thresholds from **Settings → Alert rules**:

| Flag | Default condition |
| --- | --- |
| Too few calls | Either window has fewer than 50 calls (30 in demo mode). No other flag is set. Controlled by `regression_min_calls`. |
| Mean regression | Mean time is at least 2× higher and has increased by at least 5 ms. Controlled by `regression_mean_ratio` and `regression_min_delta_ms`. |
| Volume increase | Calls are at least 3× higher, with at least 500 current calls (200 in demo mode). Controlled by `volume_calls_ratio` and `volume_min_calls`. |
| Load increase | The total-time ratio reaches `volume_calls_ratio` (3 by default). |

A **mean regression** means each call became slower. A **volume increase** means the statement ran more often. LockLens presents them separately because they need different investigations.

## Rules built on the workload

Six statement rules compare current activity with each statement’s historical baseline. The baseline uses the median and median absolute deviation (MAD) for each hour of the day. While it is learning, rules fall back to the preceding equal window.

| Setting or behavior | Default |
| --- | --- |
| Evaluation window | `workload_window_seconds`: 900 seconds; 120 seconds in demo mode |
| Minimum coverage | `workload_min_coverage`: 80% |
| Findings per rule | Up to five queries, strongest first |
| Incident trigger | `queries.mean_regression` |
| Statements still running | Observed by `queries.long_running` |

If coverage is below the minimum, rules report **insufficient data** together with the measured coverage.

Continue with [Query performance intelligence](query-intelligence.md) or [Rules and findings](rules.md).

## Limitations

- **No percentiles or individual outliers.** `pg_stat_statements` keeps aggregate counters, not samples of each execution. Only window means are available.
- **A slower mean is not a diagnosis.** LockLens does not run `EXPLAIN` for this analysis. Plan changes, lock waits, I/O, and larger results are possibilities to investigate.
- **Statement text can contain sensitive data.** Normalization preserves SQL structure and may preserve literals, particularly in utility statements.
- **Evictions lose observations.** `pg_stat_statements.max` limits the number of retained entries. LockLens reports the losses.
- **Monitoring queries are hidden by default.** Use `include_monitoring=true` to include the monitoring user’s statements.

## Statement types

LockLens groups each statement by the command found in its normalized SQL text.

| Command class | Included statements |
| --- | --- |
| `select` | SELECT |
| `insert` | INSERT |
| `update` | UPDATE |
| `delete` | DELETE |
| `merge` | MERGE |
| `copy` | COPY |
| `ddl` | CREATE, ALTER, DROP, TRUNCATE, GRANT, REVOKE, COMMENT, and related commands |
| `transaction` | BEGIN, COMMIT, ROLLBACK, SAVEPOINT, RELEASE, PREPARE TRANSACTION |
| `maintenance` | VACUUM, ANALYZE, REINDEX, CLUSTER, CHECKPOINT |
| `utility` | SET, SHOW, RESET, EXPLAIN, DO, CALL, LOCK, cursor commands, LISTEN, NOTIFY, and related commands |
| `other` | Statements without a recognized class |

### Classification rules

- Comments are skipped before inspecting the leading keyword.
- For a `WITH` query, the first SELECT or data-modifying keyword at parenthesis depth zero after the common table expressions determines the class.
- For `PREPARE name AS …`, the prepared statement determines the class.

This is keyword-based grouping, not a SQL parser. For example, a `DO` block that deletes rows is still classified as `utility`.

The collector reads normalized text to classify a statement, even when SQL text storage is disabled. Older identities remain `other` until collected again.

### Totals and rates

The command endpoint returns totals and a time series for each class:

```http
GET /api/v1/targets/{id}/queries/commands
```

Use the `command` query parameter to filter the statement list.

Rates divide each bucket’s total by the statement-collection time it covers:

- **Covered bucket, no statements:** the rate is zero.
- **Uncovered bucket:** the rate is unknown.

## SQL text privacy

SQL text is collected by default so the **Queries** and **Sessions** pages can display it. Normalized statement text is stored once per identity; live session queries are retained in activity snapshots.

### Turn off SQL text collection

Open **Settings → Instances → Edit**, then disable **Collect SQL text**.

When disabled:

- Statement text is read briefly for classification, then discarded.
- Session queries are not collected.
- Previously stored statement texts for that target are deleted.

### API responses and exports

The API returns SQL text when collection is enabled, unless the request uses `include_text=false`. Exports include text only when explicitly requested.

SQL text is never included in Prometheus labels, logs, or error messages.

> **Treat collected SQL as sensitive data.** Normalized statements typically replace literal values with placeholders such as `$1` and `$2`. Running queries, utility statements, identifiers, and comments can still contain data. Redaction cannot guarantee that all literals are removed.
