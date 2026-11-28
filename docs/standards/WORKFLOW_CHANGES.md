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
| `AGENTS.md` | Rewritten in plain English (about 3,900 words down to about 2,100). Keeps the hard safety rules, the Firestore rules, code conventions and test commands. Adds rules for handling discoveries (options with a cost in days), for Linear, and for owner decisions. The rule changes are listed below. | git history |
| `CLAUDE.md` | Now just points to AGENTS.md and describes Claude's usual role (second reviewer, or fresh-eyes builder). | git history |
| `.github/pull_request_template.md` | Shortened to: what changed, how to see it, checks run and skipped, second review, owner decisions. | git history |
| `.github/workflows/claude-independent-review.yml` | The reviewer is now told to read AGENTS.md and the Architect boundary instead of the two retired guides, and to check any NBA rule the change depends on against the rule text quoted from the pinned rulebook lookup. The review robot's safety mechanics (exact versions checked, read-only access, verdict publishing) are unchanged. | git history |
| `.github/workflows/ci.yml` | Removed a job that only ran for one old branch (`feature/bze-321-hosted-draft-review`) and the trigger for `copilot/**` branches. The checks that run on every pull request and nightly are unchanged. | git history |
| `tests/tooling/phase3aWorkflow.node-test.ts` | Four tests that checked the exact wording of the retired Phase 3A guide and the old PR template were replaced by two tests: one keeps every real check on the Trade Receipt screenshot-proof tool, the other checks that the new PR template still says skipped checks are never reported as passed and still asks about second review. A helper function only those four tests used was removed. All other tests in the file are unchanged. | git history |
| `README.md` | Corrected out-of-date details (files and folders that no longer exist, Python helpers, Zustand, Firebase Hosting). The site is hosted on Vercel. | git history |
| `docs/INDEX.md` | Corrected the note about generated docs (they are regenerated when needed, not on every commit). | git history |
| `.husky/pre-push` | Fixed the path in its error message to the type-cast ledger doc, which had moved. | git history |
| `docs/reference/PROJECT_SCHEMA.md` | Removed a row for a `cba/` folder that no longer exists and the mention of Copilot configuration. | git history |

### Removed (tools the owner no longer uses)

| Removed | What it was | Where it is now |
| --- | --- | --- |
| `.cursor/` (9 commands, 1 rule) | Cursor editor commands and a Graphify rule | git history |
| `.github/copilot-instructions.md` | GitHub Copilot instructions (Copilot's last commit was May 2, 2026) | git history |
| `.github/chatmodes/` (2 files) | GitHub Copilot chat modes from August 2025 | git history |
| `.claude/settings.json` | Hooks that told Claude to use Graphify instead of reading files. The graph isn't in the repository, so cloud sessions couldn't use it, and it contradicted CLAUDE.md. | git history |

### Rule changes in AGENTS.md

So nothing changes without a record, these are the ways the new rules behave
differently from the old ones:

- **Branches and pull requests.** The old file said not to create branches or
  pull requests unless asked, while also describing branch naming and PR
  workflows (the two contradicted each other). Agents now work on a branch and
  open a pull request by default. Merging or pushing to `main` still needs the
  owner's OK.
- **Second review.** No longer tied to three "execution levels" or a frozen
  exact-version ritual. It's required for money, legality, saved data, shared
  state, permissions, security, NBA source data accepted as fact, changes to the
  checks themselves, and whenever the test runner says `review: required`. A
  fresh Codex session counts as well as Claude.
- **Linear priority.** "High means the one active lane" is replaced by "use
  priority only for Urgent (the live site is broken)". Order in the list is the
  priority.
- **Linear branch names.** Issue numbers in branch names and pull request titles
  close that issue on merge, so only the finished step's number goes there,
  never a parent or goal issue like BZE-243. (Branches named `bze-243-*` are why
  BZE-243 kept flipping to Done.)
- **Closing comments.** Linear gets a three-line note with the pull request link;
  the commit hash and full list of checks live in the pull request.
- **Owner decisions.** Agents post through the owner's Linear account, so they
  must label relayed decisions ("Owner said in chat (date): …") and never write
  text that reads as the owner's own decision.
- **Discoveries.** When something changes the plan, agents stop and give the
  owner options with a cost in days, defaulting to the cheapest honest option,
  instead of starting investigations on their own.
- **Privacy.** A plain rule now forbids putting private data anywhere public;
  the repository itself is public.
- **Visible design changes** still need the owner's approval from screenshots
  or a preview before merging, now for every part of the app, not only
  Architect. Work under a plan with one batched owner review (such as Architect
  V1's final review) follows that plan.
- **NBA rules in reviews.** When a change depends on an NBA rule, the author
  pastes the rule text from the pinned rulebook lookup into the review request,
  and the reviewer treats an unquoted rule dependency as a finding.
- **New "never without the owner's OK" items:** deleting or replacing saved
  data, docs or plans (or rewriting git history), contacting outside people or
  companies, adding scope, and putting private data anywhere public. The old
  file had no general rule for these.
- **Return packages, Graphify refreshes, retained browser certificates, hash
  receipts and evidence ledgers** are no longer part of ordinary work.

### Retired but kept in place (moved to the archive in stage 2, below)

`docs/agent-guides/phase3a-execution.md` and
`docs/agent-guides/independent-review-boundary.md` are no longer followed for
ordinary work. They were left unchanged, in their original location, because:

- the official-NBA-HTML source tool fingerprints the first one;
- a test (`accepted Canon documentation and durable ref match the runtime pin`)
  checks that the first one records the pinned rulebook version, so the pin must
  move to another document before that file can be retired fully;
- the NBA data-publication review workflows (`nba-maintenance-source-review.yml`,
  `bze321-private-source-review.yml`) still ask their reviewer to read the
  second.

Both files still mention "the three execution levels in AGENTS.md", which no
longer exist. That's expected until stage 2.

### Not changed in stage 1

- The existing "never without the owner's OK" safety rules (source data,
  production, billing, merging). Stage 1 only added to them (see the list
  above) and added `architect_draftPickReleases` to the protected source data.
- The automatic test runner (`npm run test:diff`) and what CI checks.
- The NBA rules lookup (`npm run architect:canon:lookup`) and its pinned rulebook.
- The Architect V1 checklist and completion contract (Codex is still working
  from them).
- Linear.
- `.codex/` (Codex is the main builder; its setup was left alone, including a
  Graphify hook that only works on one Mac).
- `.claude/commands/review.md` (an optional audit prompt; kept in case it's
  being used).
- The `work/bze-*` folders. Several end-to-end tests, maintenance workflows and
  runbooks read or write files in them, so moving them would break those.

### Planned for stage 2

See the stage 2 section below for what was done and what's still open.

## November 22, 2026: stage 2 of the workflow cleanup (part 1)

The owner approved stage 2 in chat on November 22, 2026, limited to process
cleanup. Hosting, the nightly test failure and the July cap-hold check were
left to Codex as project work.

### Linear

| Issue | Change | Why |
| --- | --- | --- |
| BZE-309 | Canceled, with a closing comment | Certifying every pick's real-world history was replaced by the November 10 simulation standard. |
| BZE-321 | Canceled, with a closing comment | Same reason. Its two unfinished clean-up tasks moved to BZE-346. |
| BZE-329 | Canceled, with a closing comment | Its delivered work landed in PRs #582–#597; the rest (future seasons) is post-V1 in the V1 checklist. |
| BZE-346 | **Created** | Holds the two leftover security clean-up tasks from October that were buried in BZE-321: a read-only check of leftover Google access, and deleting seven used-up password and transfer files. Both need the owner's OK before anything is removed. |

Nothing was deleted in Linear. Canceled issues keep their descriptions,
comments and attachments and can be reopened. Old finished Linear projects
were not archived, because the available tools can't archive projects; they
are already marked Completed.

### Project files

| Item | Change | Where it is now |
| --- | --- | --- |
| `docs/agent-guides/phase3a-execution.md` | Moved to the archive, unchanged | `archive/docs/agent-guides/` |
| `docs/agent-guides/independent-review-boundary.md` | Moved to the archive, unchanged | `archive/docs/agent-guides/` |
| `.github/workflows/bze321-hosted-review.yml`, `bze321-private-source-review.yml` | Retired: moved, unchanged. They only ran for a branch that no longer exists, and their secrets were deleted in October. | `archive/github-workflows/` |
| `tests/tooling/privateSourceReview.node-test.ts` | Removed. It only tested the retired private-review workflow. The test runner blocks moving a test to where it would silently stop running, so it was removed instead. | git history (the version before this stage 2 change) |
| `.github/workflows/ci.yml` | Removed the nightly step that ran the removed test | git history |
| `docs/reference/cba/README.md` | Rewritten. It wrongly said no rulebook was accepted. It now says Canon v2.0 is accepted, records the pinned version (moved here from the Phase 3A guide), and warns that the file in that folder is the rejected v1.1. | git history |
| `tests/tooling/phase3aWorkflow.node-test.ts` | The pinned-rulebook test now reads the pin from `docs/reference/cba/README.md` | git history |
| `scripts/run-tests-by-diff.mjs`, `tests/runTestsByDiff.test.ts` | The test runner now treats `docs/reference/cba/README.md` as a protected rules file, the way it treated the old Phase 3A guide. Editing it requires a second review and runs the rulebook pin test. A new test case checks this. Added after the independent review found the gap. | git history |
| `scripts/source-releases/official-nba-html/cli.ts` | Points at the archived Phase 3A guide's new path (the file's contents are unchanged) | git history |
| `.github/workflows/nba-maintenance-source-review.yml` | The NBA data review robot now reads AGENTS.md's second-review section, with two plain sentences of reviewer guidance, instead of the archived guide. Nothing else in it changed. | git history |
| `docs/operations/BZE321_FIREBASE_INSTALLATION.md` | Added a note that its two workflows were retired and where the copies are | git history |
| `AGENTS.md` | The note about the two retired guides now points to the archive and the rulebook README | git history |

Old plans in `work/` that link to the two archived guides were left
unchanged, so those links are now broken; the files are in
`archive/docs/agent-guides/`. The official-NBA-HTML tool (`cli.ts`) still reads
the archived Phase 3A guide, so don't delete it from the archive.

### Still open after stage 2 (part 1)

- Leftovers from the retired BZE-321 hosted review that are still in place:
  `.github/draft-private-review-request.json` (kept, because
  `tests/architect/draftSourceInstallation.test.ts` checks it),
  `scripts/architect/verifyHostedDraftReview.ts`, and the nightly
  "Hosted review browser redirect boundary" step. They may be useful for future
  hosting checks; decide with Codex whether to keep them.
- Remove the now-unused `test:private-source-review` script from
  `package.json`. It was left in place because any change to `package.json`
  makes the test runner run the full suite, which currently fails on an
  unrelated test (the contract-history guard that Codex is fixing). Nothing
  calls the script anymore.
- Rewrite the V1 checklist in plain English and move the plan to Linear, and
  stop BZE-243 from closing itself. Waiting until Codex finishes the hosting
  work it is doing from that checklist.
- Choose a permanent private home for the private data packages (needs the
  owner's OK; a private GitHub repository is suggested).
- Consider turning on GitHub branch protection for `main` so tests must pass
  before anything merges (needs the owner's OK).

## November 28, 2026: simplify the operating model

**Why.** The owner set the principle: be rigorous about NBA rule correctness,
money calculations, saved-world integrity, data accuracy and real security, and
pragmatic about everything else. The November 22 cleanup left several sources
of approval and review stops in place. The test runner marked almost every
change "review: required", because file names containing words like "cap",
"trade" or "commit", any deletion, any edit to the rules, and any import of
Firebase all counted. AGENTS.md then required a second review whenever the
runner said so. Merging, every visible change and deleting a doc each needed
the owner. The Architect boundary kept work in separate "lanes", and the V1
contract applied its final-acceptance evidence standard to every workflow
change.

### What changed

| Item | Change | Where the old version is |
| --- | --- | --- |
| `AGENTS.md` | Rewritten around the principle above. Agents merge their own pull requests when CI is green and any required second review passed. Owner approval is limited to the "Ask the owner first" list: source data, production and Firebase deployments, migration, billing, credentials, permissions and settings, outside contact, private data, deleting saved user data, product scope, and redesigns. Ordinary visible changes no longer wait for approval. Second review is required for money, legality and rule logic, saved-world writes, security, source data accepted as fact, and weakening tests, but not for screens, docs, these rules or tooling. Discoveries stop work only when they change what the product does, its scope, cost or schedule. Related work can share one pull request. Superseded docs can be deleted or archived. | git history |
| `.github/pull_request_template.md` | The second-review line now names when one is needed. | git history |
| `docs/agent-guides/architect-v1-completion-contract.md` | Rewritten as one current-state page. Dated override layers are folded into the current text; every required workflow, owner decision and exclusion is kept. Product acceptance (the E1 battery and E2 owner review) is separate from individual changes, which follow AGENTS.md. Per-workflow "live browser proof, owner review" evidence rules now apply to the final battery only. The post-V1 trade-bonus "certified release" unblock condition is removed; trade bonuses stay post-V1 and must stop with needs-input. | git history |
| `docs/agent-guides/architect-boundary.md` | Keeps trusted surfaces, the Trade Machine build direction, the data architecture and the design laws. The "scope protection" lanes (no engine changes in UI work, splitting issues), duplicated owner gates and the validation section are removed; AGENTS.md covers them. | git history |
| `work/architect-completion/V1_FINISH_CHECKLIST.md` | The duplicated target and standing decisions now point to the contract. The working rule points to AGENTS.md. E1 no longer calls an "exact-candidate" review a landing gate. Item status text is unchanged. | git history |
| `scripts/run-tests-by-diff.mjs`, `tests/runTestsByDiff.test.ts` | The runner only selects checks; it no longer prints `review: required`, and the `Validation-Review` trailer is ignored. Rules and doc edits no longer pull in the tooling suites; the files that tests read by path (the rulebook pin note and several workflows) map to those tests. A `package.json` edit limited to helper scripts no longer triggers the full suite. Native test files run one at a time, because two tooling suites interfere in parallel (this already failed on `main`). The three review-classification test groups were removed. All other runner tests remain, and new ones cover the new behavior. | git history |
| `.github/workflows/claude-independent-review.yml`, `tests/tooling/claudeIndependentReview.node-test.ts` | `/claude-independent-review` on its own reviews the pull request's current commit; explicit SHAs still work. Wording about "frozen exact candidates" is plain now. The writer check, read-only checker, credential scanning, live-identity checks and receipt format are unchanged. The NBA data publication workflow reads that receipt format. New test cases cover the bare request. | git history |
| `tests/tooling/phase3aWorkflow.node-test.ts` | Removed the test that checked the pull request template's wording. | git history |
| `package.json` | Removed the unused `docs:guardrails` and `test:private-source-review` scripts and stale `lint:md` ignores. | git history |
| `docs/guides/CONTRIBUTING.md`, `docs/INDEX.md`, `docs/reference/PROJECT_SCHEMA.md`, `docs/operations/CLOUD_DEVELOPMENT.md`, `.claudeignore` | The contributing guide's own branch naming, PR checklist (full suite, lint) and "maintainer approval" process now point to AGENTS.md. Stale return-package and guardrail references are removed. | git history |
| `docs/standards/DOCUMENTATION_STRUCTURE_STANDARD.md` | Now the single documentation-placement standard, absorbing the useful parts of the two docs below. | git history |

### Removed or retired

| Removed | What it was | Where it is now |
| --- | --- | --- |
| `docs/standards/RETURN_PACKAGE_STANDARD.md`, `WORKSPACE_GUARDRAILS.md` | Return-package rules (return packages were retired November 22) | `archive/docs/standards/` |
| `docs/standards/COMMUNICATION_RULES.md` | Duplicated AGENTS.md's owner rules and required "extreme detail" plans | `archive/docs/standards/` |
| `docs/standards/CREATING_PERMANENT_DOCS.md`, `DOCUMENTATION_UPDATE_RULES.md` | Overlapping documentation rules, merged into the structure standard | `archive/docs/standards/` |
| `.claude/commands/review.md` | An audit prompt that replaced Claude Code's built-in `/review` and produced a "preflight return package". The owner's audit template remains in `docs/PROACTIVE_AUDIT_TEMPLATE.md`. | `archive/docs/standards/claude-review-command.md` |
| `.codex/hooks.json` | A Codex hook that ran Graphify from a path on one Mac before every shell command. It fails elsewhere and contradicted "Graphify is optional". The Graphify skill in `.codex/skills/` is unchanged. | git history |
| `scripts/docs/checkWorkspaceGuardrails.mjs` | Checked that no return packages lived in `docs/` | git history |

### Not changed

- Every "Ask the owner first" safety item from November 22 except merging, which
  is now routine.
- Application tests, NBA rulebook lookup and pin test, security tests of the
  review workflow, CI's pull request and nightly jobs, the Architect type-cast
  gate, and the NBA data maintenance and publication workflows.
- `work/architect-completion/ARCHITECT_COMPLETION_EXECUTION_PLAN.md`, which
  Codex updates as steps land. It already agrees with these rules (routine
  merges are authorized; publication, deployments and scope stay gated).
- The retired BZE-321 draft-review workflows and their tests. They only run for
  a branch that no longer exists and impose nothing on ordinary work.
