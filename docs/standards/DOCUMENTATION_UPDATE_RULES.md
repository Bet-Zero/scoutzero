# Documentation Update Rules

Keep significant durable knowledge accurate without manufacturing documents or
unrelated work. Use the existing authoritative home. New files and changed line
counts are not documentation triggers by themselves.

## What needs updating

| Actual change | Relevant documentation/check |
| --- | --- |
| Public behavior or API contract | Update its existing guide/contract when a reader needs the new information |
| Repository layout or tooling interface | Update the affected existing tooling/schema guide; validate structure when its contract changes |
| Zod/Firestore schema meaning | Update canonical schemas and regenerate/check affected generated reference |
| Source qualification or publication procedure | Update the governing operational contract; retain privacy and owner gates |
| Existing coordinated plan state | Update applicable plan status; link detailed evidence to the PR |
| Local color, spacing, ordinary copy, or implementation bug fix | Usually no permanent-doc change; explain verification in the PR |

A source comment, CLI help text, existing README or guide may be the smallest
useful durable update. Create a new README/guide only when an existing home cannot
serve a distinct audience or recurring need. See `CREATING_PERMANENT_DOCS.md` for
placement and optional content guidance; no mandatory header/README template
applies to every feature, script or data module.

## Generated documentation

Do not manually edit generated schema/component outputs. Regenerate schema docs
when the schema contract changes. Run `npm run docs` only when changed topology
makes an applicable generated relationship stale or an explicit doc-sync task
requires it. Git hooks do not regenerate or stage documentation automatically.

## Verification and delivery

Use `node scripts/run-tests-by-diff.mjs --docs` for changed Markdown and applicable
routing guardrails. This is not a command to repeat before and after every edit.
Do not relint unrelated historical files to validate a narrow docs correction.
Use `validate:project` when repository layout/contracts change, and schema checks
when schema meaning changes; command tables are options, not universal gates.

Keep detailed implementation, test and review evidence in the PR. An existing
issue receives a concise status pointer. Update an active plan when its actual
execution state changes, without copying the narrative into multiple places.
No new plan, return package, status collection or follow-on phase is required.
Preserve the working planning/handoff rules in `AGENTS.md` and existing approvals.

Finish once the authorized outcome, relevant documentation and verification are
complete. Report real blockers or unrelated failures honestly; do not convert
them into new assignments or clean up historical records without authorization.
