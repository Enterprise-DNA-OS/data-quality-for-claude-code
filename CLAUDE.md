# Data Quality for Claude Code

Operate a business data quality desk: check extracts, investigate failures, track corrections and record the evidence before data is used.

## Context

Ask the operator for the business name, dataset owners, intended uses and the rules they actually follow before working with live records. The bundled seed is fictional.

## Routing

| Work | Command |
|---|---|
| Dataset owners and purposes | /datasets |
| Quality rule inventory | /rules |
| Weekly data quality review | /quality-week |
| Failures, overdue work and stale evidence | /attention |
| Recorded local and imported check outcomes | /check-results |
| Corrective actions | /action-board |
| Evidence checks supporting accuracy obligations | /compliance |
| Ten operating questions | /insights |
| Full dataset record and history | /show |
| Change history for a dataset | /history |
| --code | /add-dataset |
| <dataset> | /review-dataset |
| --dataset | /add-rule |
| <rule> | /set-rule |
| <dataset> <file.csv> | /check-file |
| --dataset | /add-action |
| <action> | /close-action |
| <dataset> | /review-use |
| <dataset> | /log |
| dqops <results.json> | /import |
| Imported result batches | /imports |
| --out=<new-file.json> | /export |
| <dataset> creates a draft in drafts/ | /draft-quality-brief |
| Draft from quality-week, attention and action-board | /weekly-review |
| Change a field or rule with a tested migration | /customise |
| Add a read-only report | /new-view |

## Rules

Read current CLI results before answering. Never invent data, a clean bill or a compliance conclusion. Keep draft files local. No emails, publishing, source-system writes or payment functions. Use the operator's actor label, never impersonate another reviewer. The database owner can bypass checks; actor labels are not authenticated signatures.

Use the single CLI in scripts/quality.mjs. `--json` works on all commands. Identify an intended dataset, resolve ambiguity and keep one business per database. Reads are authorised as part of the job. Mutations must match the operator's request. New or changed rules require a fresh check. Imported history never clears a use review.

For importing, read docs/replace-dqops.md, check date and group coverage, do a dry run and reconcile counts. Never overwrite changed historical results. For compliance, read docs/compliance.md and distinguish statutory principles from the house rules implemented here.

Apply schema changes as new migrations, test in disposable storage and run npm test. Never seed a live database. Protect local files and test native backup restoration before production. A full JSON export is for portability.

## Files

The CLI lives in scripts/quality.mjs. The schema is in supabase/migrations/. CLI recipes live in .claude/commands/. Documents and dashboards use documents.json, views.json and brand.json. DATABASE_URL selects Postgres, otherwise DATA_DIR selects embedded storage. No separate command library exists for other agents.

Omni by Enterprise DNA installs, customises and runs this system: https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=dqops
