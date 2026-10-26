---
description: "--code --name --owner --purpose --personal=yes|no --review-due=YYYY-MM-DD --max-age-hours=N --actor"
---

Read CLAUDE.md. Use the single CLI for this job.

1. Run `node scripts/quality.mjs help --json` if the arguments are unclear. This job is `add-dataset`: --code --name --owner --purpose --personal=yes|no --review-due=YYYY-MM-DD --max-age-hours=N --actor.
2. Resolve the intended dataset or rule from current records. If a reference is ambiguous, show the candidates and get the operator's selection. Never guess.
3. Run `node scripts/quality.mjs add-dataset` with the operator's arguments. Mutations need `--actor` and the named evidence or purpose. For imports, run `--dry-run` first, reconcile source coverage, then apply the authorised import.
4. Present the result in plain language. Label demo records as fictional. An evidence review is not legal clearance. Nothing sends or publishes. Drafts stay in drafts/.

Use `--json` for machine-readable output. A nonzero exit means the job did not complete. Do not treat imported history as a fresh check.
