# Accuracy evidence for NZ and AU operators

Sources checked 26 October 2026. This system records checks and human evidence. It does not certify legal compliance, decide whether an entity is covered, or prove that a value matches reality.

## NZ: information privacy principle 8

The [Privacy Commissioner](https://www.privacy.org.nz/privacy-principles/8/) explains the accuracy checks required before personal information is used or disclosed. The owner must assess correctness, currency, completeness, relevance and whether a record is misleading.

The software's missing, duplicate, range, allowed-value and freshness checks provide limited evidence about an extract. They cannot verify a person's actual circumstances or determine whether a use is appropriate.

## AU: APP 10

The [OAIC's APP 10 guidance](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-10-app-10-quality-of-personal-information) describes reasonable steps for quality at collection and at use or disclosure. Assess whether APP obligations apply to the business separately. Checks should reflect the information's sensitivity and intended purpose.

## Implemented rules

| Finding | What is checked | Basis |
|---|---|---|
| OWNER | A dataset owner is recorded | House accountability control supporting the two sources above |
| PURPOSE | A stated use is recorded | House evidence for assessing relevance |
| REVIEW_DUE | The operator's chosen review date has not passed | House review cadence, not a statutory period |
| NO_RULES | The dataset has active checks | House completeness control |
| STALE_CHECK | Latest local run is within the configured hours | House freshness control, not a statutory deadline |
| FAILED_CHECK | No active check failed in the latest local batch | Evidence requiring investigation |
| RULE_CHANGED | Latest run used the current active rule definitions | House rule-version control |
| OPEN_ACTION | No correction remains open | Conservative house release rule |
| USE_REVIEW | Personal data has evidence tied to the latest batch and purpose | Attention reminder supporting use/disclosure assessment |

`compliance` returns the first eight evidence findings. `attention` adds use-review gaps and overdue actions. `review-use` refuses to record a review while any of the first eight findings remains. A successful review records a human assertion with evidence, not legal clearance or permission to send anything. Review validity ends with the batch age limit, a newer batch or changed purpose. Current failures and changed rules still block a new review even if an older review record remains in history.

No bank feeds, payroll, payment functions or automated notices exist. Do not put personal failing values into action notes or evidence when a reference to a protected source is enough. Retention and access controls need to be set for the business before live use.
