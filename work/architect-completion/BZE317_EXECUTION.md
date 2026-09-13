# BZE-317 — synthetic freeze-event history and subsequent first trade

Delivery status and exact acceptance/landing receipts are tracked on BZE-317
and its linked PR. This document records implementation and author evidence;
passing author checks alone is not independent acceptance.
Base: accepted main `b3f70a08133903f2bf0818861bf6ee26c0148516`.

## Scope and authority

This is the next single sustained-run implementation under BZE-243, following
accepted BZE-315 and BZE-316. It uses the existing Season Advance writer and
existing trade mutation writer, with no new persistence system. Normal
first-round Apply remains blocked. Source collections remain read-only,
including emulator source collections. No source acquisition was performed.

Pinned accepted Canon lookup `CBA2-L08.3` supplies persistence only: retain the
accepted `CBA2-A12.4` result, trigger Salary Cap Year, measurement timestamp,
identified seventh-following-Draft original pick and source result ID. The
existing `evaluateDraftApronFreeze` remains the sole algorithm owner. No current
restriction release, penalty, placement or trading verdict is inferred from a
historical trigger record. Canon pin: `6cf8aaf358c158a88e630e8a7336f7e9c3febc17`,
artifact SHA256 `23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`.

Actual registry inspection changed the proposed proof order. Accepted calendars
and target core levels support Season Advance from 2025-26 to 2026-27. The
registry has no complete 2025-26 core salary levels for a preceding trade and
no 2027-28 levels for a subsequent advance. The proof therefore advances the
original inventory first, then executes the supported original-first exchange
in 2026-27. It does not prove a traded pick crossing another season. Neither
unknown year-specific authority nor future outcomes are supplied by this work.

## Software fixture and supported consumption

The seven accepted BZE-315 release bytes and pins stay fixed. One separate v2
synthetic trade source, one retained lifecycle artifact, and an independent
payload/release pin identify this finite software case. The release is installed
when creating the synthetic world; no saved world adopts a successor release.
The fixture supplies 30 complete team inventories, original firsts, no current
Draft assets or conditional programs, and season-close Apron observations.

The historical threshold of $200 million is an explicit invented test value.
It is never installed in the governed salary-level registry or used to satisfy
an ordinary trade's salary-level gate. BOS has 15 standard contracts at $17m;
the other teams have 15 at $2m; each has three two-way contracts. Independent
fixture arithmetic expects $255m/$30m in each governed target salary book.
BOS's supplied 2025-26 observation triggers the historical freeze of its 2033
original first. Other supplied observations are below the synthetic threshold.
The later trade moves BOS's 2028 original first for MIA's 2028 second.

A private one-use capability requires the actual development/review/demo
Firestore emulator connection, exact owned parentless world, pinned release,
complete inventory, unchanged measurement and current governed season context.
The existing Season Advance transaction re-reads all consumed metadata, team,
and entitlement documents. Complete embedded roster/contracts are fenced by
the team snapshots: this `getLeague` path does not consume player overrides.
The later trade issuer independently fences its own actual dependencies.
It commits 30 teams, immutable
season histories, one manifest, one event and one metadata increment together.
The freeze records accompany existing season history and event metadata.
Existing draft positions still trigger the required-transition stop.

The full 18-player, 30-team fixture exposed a concrete event-size interaction:
duplicated detailed salary books made the synthetic season event approximately
972 KB, above the existing 900 KB safety margin. The limit remains unchanged.
Only the synthetic event stores exact scalar display totals and per-team
immutable-history references/digests; all detailed before/after books remain in
the existing season histories, written in the same transaction. Production
Season Advance event shape remains unchanged. Proof must verify both the
display totals and full-history digest linkage, not just successful writes.

History displays the actual original pick and historical trigger, with an
explicit synthetic scope and no current trading permission. Review-only Compare
accepts only this supplied preservation event before its matching trade; later
or unknown season/pick-changing events remain unavailable. The accepted BZE-315
collection-membership observation remains a prerequisite before non-synthetic
or live rollout; this fixed local fixture does not waive it.

## Validation and review

Required: targeted new domain and actual-writer tests; relevant predecessor
season and comparison tests; typecheck; scoped UI/history checks; project and
schema checks with their limited scope stated; docs guardrails; build; Graphify;
hosted exact-head CI; browser/emulator evidence with both-team leave/return/full
reload and real atomic-denial proof; focused independent Claude acceptance.

The browser proof uses one owned world-only demo emulator and four bounded
Playwright phases: actual season persistence, continuation trade and both-team
reload, negative inputs, and final-write denial. Each phase has a four-minute
process limit. The continuation restores the local emulator browser identity
and compares the entire saved world with the prior exact-candidate checkpoint
before preparing its trade. It never seeds or imports an advanced result.
The coordinator requires free ports at entry and clean teardown at exit.

Diagnostics exposed cold startup and Firestore waits exceeding one combined
run's limit. A CPU profile showed about 32 of 52 seconds idle during advance;
no hashing or safety check was weakened. Earlier stopped runs remain failures,
even when they committed the season or trade before timing out. The split
persistence phase passed in 53.6 seconds; its continuation passed with both-team
screens/re-entry/reload. The first history screenshots put the new record below
the fold; evidence capture now scrolls the record and disclosure into view.

Completed local receipts (September 13, 2026):

- `npm run test:node -- tests/architect/draftReviewSeason.test.ts tests/architect/draftReviewComparison.test.ts tests/architect/draftReviewWorldFixture.test.ts src/tests/architect/teamHistory.normalization.displayContract.guardrail.test.ts --reporter=dot`: 44 passed, 59.78 seconds, after the History fallback repair. The earlier 31 existing Season Advance cases also passed in the initial scoped run; unaffected normal-season evidence is reused.
- `npm run test:ui -- src/tests/architect/teamHistory.detailView.integration.test.tsx src/tests/architect/stage3c.comparisonUI.test.tsx --reporter=dot`: 38 passed, 16.53 seconds.
- `npm run typecheck`, `npm run validate:project`, `npm run build`, `npm run docs:guardrails`, and scoped Markdown lint passed. Build emitted existing chunk-size guidance.
- `npm run schema:check` passed on the permitted retry after the initial local tsx socket denial. This legacy generator does not validate these new Zod contracts; the explicit domain tests do. No schema-generator success is claimed as lifecycle proof.
- `npm run test:phase3a-workflow`: 19 passed after updating the old per-process teardown assertion for a shared owned emulator. Final clean teardown, every phase passing, screenshot decoding/hashes and complete evidence remain required.
- `node_modules/.bin/tsx scripts/review/buildSyntheticDraftSeasonFixture.ts` followed by formatting reproduced both new generated files byte-for-byte. Accepted BZE-315 release bytes and pins are unchanged.
- `graphify update .`: AST update completed, 18,551 nodes / 39,491 edges. Post-commit freshness is checked separately.
- Browser diagnostics: actual 30-team persistence passed; continuation trade and both-team History/Compare leave/return/full reload passed; six default/forged/stale cases passed with no writes; actual rules denial of the final metadata write passed with no partial state. The final finished-display/shared-coordinator diagnostic and retained exact-head certificate are linked from the PR, with each phase separately budgeted and failures kept distinct.

Local logs are retained under the sustained owner's durable continuation record.
The PR is the detailed evidence hub for final exact-head CI, browser certificate,
checker verdict, any delta repairs, and landing. No manual full suite or broad
trade/Architect suite was run: this change uses the scoped checks above. No
NBA source research, production activation or W10/V1 acceptance is claimed.
Prior failed or stopped diagnostic runs are not passes.
