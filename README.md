# Data Quality for Claude Code

Check business extracts, keep the evidence and put each correction with an owner. Your rules and history live in one database.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free MIT code. Install and operate it yourself. | Your rules, records, reports and connections. | Installed and operated through Omni by Enterprise DNA. |
| [Quick start](#quick-start) | One setup fee, then a retainer. [Build our version](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=dqops) | One setup fee, then a retainer. [Talk to Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=dqops) |

## The annual bill

[DQOps Team](https://dqops.com/pricing) lists $2,000 a month billed annually, equivalent to $24,000 a year, checked 26 October 2026. The page uses a dollar sign without naming the currency. Confirm currency and taxes in your quote. Personal is $600 a month billed annually. Enterprise is quoted. These are published rates, not a customer's invoice.

DQOps itself is open source and offers a much broader monitoring platform. This independent project replaces a bounded workflow: checks on CSV extracts, historical check-result imports, corrective actions and evidence before records are used. It does not reproduce DQOps' warehouse connectors, scheduling engine or complete check library. Compare your actual workload before switching.

## Quick start

Node 20 or later. PGlite runs locally without a server. Postgres 15 or later supports a shared deployment.

```bash
git clone https://github.com/Enterprise-DNA-OS/data-quality-for-claude-code.git
cd data-quality-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
node scripts/quality.mjs help
```

The demo is fictional. It deliberately has duplicated contact references, a missing email, a zero order quantity, an unfamiliar status, overdue corrections and stock data without a current check. Seeding is idempotent and dates are relative to the first seed. For real data, start with an empty DATA_DIR and migrate without seeding.

## The weekly work

- `/quality-week`: owners, review dates, last checks and open corrections.
- `/check-file`: check a CSV against the dataset's active rules.
- `/action-board`: assign and close corrections with evidence.
- `/attention`: failed checks, stale evidence and overdue work.
- `/review-use`: record the owner's evidence for a particular purpose and checked extract.
- `/weekly-review`: a draft from the week, attention and action board.
- `/draft-quality-brief`: one dataset's rules, gaps, corrections and history.
- `/compliance`: inspect record-level evidence gaps with sources in [the compliance guide](docs/compliance.md).

Every CLI command supports `--json`. Use `node scripts/quality.mjs help` for arguments. Names match without case sensitivity, UUID prefixes work, and ambiguous references list candidates and exit 1. Every mutation needs `--actor='Your name'`. That is a recorded label, not an authenticated identity.

```bash
node scripts/quality.mjs check-file ORDERS examples/orders.csv --actor='Demo operator'
node scripts/quality.mjs import dqops examples/dqops-results.json --dataset=CONTACTS --source=demo/public/contacts --actor='Demo operator' --dry-run
node scripts/quality.mjs import dqops examples/dqops-results.json --dataset=CONTACTS --source=demo/public/contacts --actor='Demo operator'
node scripts/quality.mjs export --out=quality-export.json
```

Import reads the saved JSON response from DQOps' documented check-results endpoint. Export the required date range and groups first. No live credentials or network calls are made by this CLI. [Full switching guide](docs/replace-dqops.md).

## What a check means

Supported rules: row count, missing values, duplicate values, numeric range, allowed values and timestamp freshness. Bounds are inclusive. Duplicate counts count repeated occurrences after the first. Values are case-sensitive. Blank numeric values fail. Freshness rejects invalid dates and future dates. A malformed CSV or missing required column fails the whole run. An empty extract never records a passing run. No raw business rows or failing values are saved, only file hash, counts, outcomes and rule definitions. The source file stays where you put it.

A use review requires a recent local batch, unchanged active rules, passing results, a current governance review, a named owner, a purpose and no open corrections. Its expiry is based on the batch's age, not the review time. A new batch or changed purpose requires another use review. Imported history cannot satisfy this gate. These are conservative house rules, not legal thresholds. The owner still assesses accuracy against the real world, relevance and whether the information is misleading.

## Ten questions to ask

These are implemented by `insights`. They combine your rules, reviews and corrections. No claim is made that another product cannot answer them.

1. Which datasets have no recent local check?
2. Which active rules changed after the latest run?
3. Which personal-data datasets lack use-review evidence?
4. Which corrective actions are overdue?
5. Which owners have unresolved actions?
6. Which current rules fail in the latest extract?
7. Which datasets contain history but no local test?
8. Which datasets need governance review?
9. Which datasets have no active quality rules?
10. Which failed checks recur in recorded history?

## Documents and views

`brand.json` sets the business name, logo and colours. `npm run docs` renders quality review records, corrective action records and check registers. `npm run view` renders the week, attention and latest check outcomes. All HTML is read-only and imported text is escaped. `/new-view` adds a report. No browser application or server is required.

## Your first hour: ten things to ask for

1. Put our business name and colours on the reports.
2. Register the dataset we use for our Monday report.
3. Add the owner and the reason we use those records.
4. Require a unique customer reference.
5. Find missing contact details without copying them into the results.
6. Add the status values our team accepts.
7. Set the maximum age for a fresh check.
8. Import historical results and reconcile the counts.
9. Assign an overdue correction to its owner.
10. Add a business-unit field with `/customise` and a tested migration.

## Operating boundaries

One database per business, trusted internal operators only. No public user access, scheduler, warehouse credentials, source-data correction or outbound sending exists in this base. Configure external scheduling and integrations separately. Row-level security denies untrusted roles by default; database owners can bypass application checks. CLI writes serialize with a transaction lock. Do not expose owner database credentials to end users. Protect exports, drafts and reports as business records. Use a protected local volume and tested native backups. JSON export is portable data, not a tested disaster-recovery backup.

[Compliance sources](docs/compliance.md). [Why no front end](docs/why-no-front-end.md). Tests run in disposable storage and cover all CLI commands, rule boundaries, stale evidence, changed rules, rollback, import idempotence and reports. CI covers Linux and Windows with Node 20/22, plus Postgres. A configured workflow is not proof it has passed; consult its run result.

MIT. DQOps is its owner's trademark. This project is not affiliated with DQOps.
