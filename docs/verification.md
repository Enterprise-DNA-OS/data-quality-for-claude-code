# Verification on 26 October 2026

- Node 22.23.4 on Linux, embedded PGlite: npm test PASS, 25 CLI commands, 106 assertions.
- Disposable Postgres 18.4 on Linux: the same suite PASS, 25 CLI commands, 100 assertions. The six extra embedded assertions exercise separate CLI and report processes.
- npm run demo, npm run view and npm run docs pass. Three dashboards and eight demo documents render.
- 26 slash commands ship: 24 operating recipes plus customise and new-view. Help is a separate CLI command.
- Source import fixture uses DQOps' documented result model. No customer export was available. Complete archive coverage must be reconciled for each migration.
- The first GitHub Actions run could not start because the organisation's billing or spending limit blocked hosted runners. No Windows execution is claimed. The workflow defines Node 20/22 on Windows/Linux and a separate Postgres job for a future available runner.

The test suite checks rule boundaries, missing columns, malformed CSV, strict dates, changed rules, stale checks, open corrections, use-review evidence, unknown options, import idempotence, rollback, changed historical records, export overwrite protection and HTML escaping.
