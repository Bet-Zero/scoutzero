---
name: WORKFLOW_CHANGES.md
description: Plain-English record of changes to how AI agents work on ScoutZero, and where anything removed went.
---

# Workflow changes

This page records every change to how AI agents work on this project: what
changed, why, and where the old version is. If something seems to be missing,
check here first. Nothing listed below is lost: every removed or replaced file
is still in git history, and any AI can bring it back on request ("restore
`<file>` as it was before the November 22, 2026 workflow cleanup").

## November 22, 2026: stage 1 of the workflow cleanup

**Why.** A workflow audit on November 17, 2026 found that the agent rules had
grown to about 14,600 words for Architect work, contradicted each other in
places, pointed to files that no longer exist, and required proof and review
steps sized for a regulated company rather than a personal project. The owner
approved simplifying them while keeping every real safety rule.

### What changed

| File | Change | Where the old version is |
| --- | --- | --- |
| `AGENTS.md` | Rewritten in plain English (about 3,900 words down to about 1,800). Keeps every hard safety rule, the Firestore rules, code conventions and test commands. Adds rules for handling discoveries (options with a cost in days), for Linear, and for owner decisions. | git history |
| `CLAUDE.md` | Now just points to AGENTS.md and describes Claude's usual role (second reviewer, or fresh-eyes builder). | git history |
| `.github/pull_request_template.md` | Shortened to: what changed, how to see it, checks run and skipped, second review, owner decisions. | git history |
| `.github/workflows/claude-independent-review.yml` | The reviewer is now told to read AGENTS.md and the Architect boundary instead of the two retired guides. The review robot's safety mechanics (exact versions checked, read-only access, verdict publishing) are unchanged. | git history |
| `.github/workflows/ci.yml` | Removed a job that only ran for one old branch (`feature/bze-321-hosted-draft-review`) and the trigger for `copilot/**` branches. The checks that run on every pull request and nightly are unchanged. | git history |
| `tests/tooling/phase3aWorkflow.node-test.ts` | Four tests that checked the exact wording of the retired Phase 3A guide and the old PR template were replaced by two tests: one keeps every real check on the Trade Receipt screenshot-proof tool, the other checks that the new PR template still says skipped checks are never reported as passed and still asks about second review. All other tests in the file are unchanged. | git history |
| `README.md` | Corrected out-of-date details (files and folders that no longer exist, Python helpers, Zustand, Firebase Hosting). The site is hosted on Vercel. | git history |
| `docs/INDEX.md` | Corrected the note about generated docs (they are regenerated when needed, not on every commit). | git history |
| `.husky/pre-push` | Fixed the path in its error message to the type-cast ledger doc, which had moved. | git history |

### Removed (tools the owner no longer uses)

| Removed | What it was | Where it is now |
| --- | --- | --- |
| `.cursor/` (9 commands, 1 rule) | Cursor editor commands and a Graphify rule | git history |
| `.github/copilot-instructions.md` | GitHub Copilot instructions (Copilot last used August 2025) | git history |
| `.github/chatmodes/` (2 files) | GitHub Copilot chat modes from August 2025 | git history |
| `.claude/settings.json` | Hooks that told Claude to use Graphify instead of reading files. The graph isn't in the repository, so cloud sessions couldn't use it, and it contradicted CLAUDE.md. | git history |

### Retired but kept in place

`docs/agent-guides/phase3a-execution.md` and
`docs/agent-guides/independent-review-boundary.md` are no longer followed for
ordinary work. They were left unchanged, in their original location, because the
official-NBA-HTML source tool fingerprints the first one, and the NBA
data-publication review workflows (`nba-maintenance-source-review.yml`,
`bze321-private-source-review.yml`) still ask their reviewer to read the second.

### Not changed in stage 1

- Every "never without the owner's OK" safety rule (source data, production,
  billing, merging, deleting).
- The automatic test runner (`npm run test:diff`) and what CI checks.
- The NBA rules lookup (`npm run architect:canon:lookup`) and its pinned rulebook.
- The Architect V1 checklist and completion contract (Codex is still working
  from them).
- Linear.
- `.codex/` (Codex is the main builder; its setup was left alone).
- `.claude/commands/review.md` (an optional audit prompt; kept in case it's
  being used).
- The `work/bze-*` folders. Several end-to-end tests, maintenance workflows and
  runbooks read or write files in them, so moving them would break those.

### Planned for stage 2

- Rewrite the V1 checklist in plain English and move the plan to Linear.
- Clean up Linear: cancel stale issues with a one-line reason, archive finished
  projects, and fix BZE-243's status.
- Simplify or retire the one-off `bze321-*` workflows.
- Choose a permanent private home for the private data packages.
- Re-check the July cap-hold issue (BZE-260) against the current code.
