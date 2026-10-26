# Move a data quality workflow from DQOps

DQOps is already open source. Moving to this smaller desk is a workflow choice, not an escape from inaccessible data. Keep the existing checks running until the replacement's results and operations have been reconciled.

## Export historical results

DQOps documents [check-results API operations](https://dqops.com/docs/client/operations/check_results/) and the [result data model](https://dqops.com/docs/client/models/check_results/). An operator with access saves the JSON response for the required connection, schema, dataset, columns and check types. The endpoint returns groups containing `checkResultEntries`. Pagination, date ranges, groups and `max_results_per_check` affect coverage. The default recent-results response is not the complete archive.

For example, save the response from the documented table monitoring endpoint for the appropriate connection, schema, table and time scale. Check DQOps' current endpoint documentation and your installation's authentication requirements. Do not paste credentials into this repository. Repeat the export for each needed scope, date range and group. Keep a manifest with counts and date coverage.

The fictional `examples/dqops-results.json` uses the documented model. It is a test fixture, not a captured customer export. The CLI imports saved JSON directly. Native parquet history and DQOps configuration files are not accepted by this importer.

## One local import

Register the destination dataset first. Import history for one source dataset at a time:

```bash
node scripts/quality.mjs import dqops history.json --dataset=CONTACTS --source=warehouse/public/contacts --actor='Migration operator' --dry-run
node scripts/quality.mjs import dqops history.json --dataset=CONTACTS --source=warehouse/public/contacts --actor='Migration operator'
```

Use a stable source scope unique to that DQOps connection/schema/dataset. Result IDs must be strings; this avoids precision loss for large identifiers. An unchanged repeat is skipped. Reusing an ID with changed content or mapping it to a different dataset fails the entire import. Duplicate IDs within the file fail. Malformed timestamps, future results and unsupported severity values fail. A transaction rolls back every row on error. Test runs write nothing.

| DQOps field | Destination |
|---|---|
| Result `id` with supplied source scope | Unique historical identity |
| `checkName` | Historical check name |
| `executedAt` with timezone | Measurement timestamp |
| `actualValue` | Numeric measurement or unknown |
| `severity` | Original 0-4 status, never interpreted as a new local pass |
| Group metadata and complete result entry | Preserved source metadata |
| Source file content | SHA-256 digest recorded in import history |

Imported results do not create active rules or approved use reviews. DQOps check definitions, thresholds, schedules, credentials, connections, incidents and permissions require explicit mapping. This avoids silently converting vendor rules into a different check engine.

## Start fresh checks

Define this desk's six supported kinds of rules for a real business CSV export, run `check-file`, compare counts and outcomes with the source, and correct differences before replacing a daily job. Import and local checking require no DQOps login after the files are saved. A simple workflow can move in a day; the completeness of an archive and connector work determine the full migration time.

## Reconcile before switching

Compare each imported scope's result count, earliest/latest timestamp, severity distribution and sample source IDs with the export manifest. Check `imports`, `check-results` and a full JSON `export`. Record gaps explicitly. Rebuild any needed scheduling and warehouse access before retiring those functions. Keep the original files and a tested backup until the owner confirms retention requirements and reconciliation.
