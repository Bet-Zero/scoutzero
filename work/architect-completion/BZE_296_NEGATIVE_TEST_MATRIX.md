# BZE-296 Top-Level Validation Authority Contract

This is the pre-implementation risk contract for the separately authorized
Trade Machine fail-closed presentation repair. Candidate freeze requires
permanent discriminating coverage or exact-head browser/emulator proof for
every applicable row below.

## Authority and scope

- Exact base: `0f33acfa3388971ac9015133aaf876f52dfd4be9`.
- Product authority: a validation completed successfully for the exact current
  draft and returned usable top-level preview authority, including an explicit
  legal verdict. Nonempty per-Team results are not an independent authority
  requirement for that top-level verdict.
- Identity authority: the validation hook's recorded draft key must exactly
  equal the current key. Team, player, entitlement, cash, salary-matching, or
  any other draft-key edit invalidates the result.
- Mutation authority is unchanged. A top-level `legal: false` result cannot
  preview or Apply, and direct mutation remains blocked before every batch,
  Team, event, receipt, or history write.
- UI boundary: reuse the existing Needs input treatment through the existing
  verdict, readiness, summary, validation, preview, and Apply surfaces. No
  layout or copy redesign.
- No accepted Canon leaf, governed source, validator rule, schema, persistence
  contract, or migration changes in this repair.

## Confirmed discriminator

A retained Contract with a governed nonzero trade kicker but unavailable
authenticated bonus allocation completes preview validation with top-level
`legal: false`, the existing user-facing trade-bonus reason, and empty
`teamResults`. The hook records the exact draft identity, but
`useTradeMachine.ts` currently also requires `teamResults.length > 0` before it
reports `hasCurrentValidation`. `TradeEditor.tsx` consequently hides the current
top-level authority and shows `Ready to validate`,
`Run validation before preview or apply`, and `Validation: Not validated`.

Apply is already disabled and the closure diagnostic proved zero Team/event
writes. This repair preserves that safety while making the actual blocked
authority visible.

## Duplicate-search receipt

The 2026-08-28 live Linear search used the exact strings
`hasCurrentValidation`, `teamResults`, `Ready to validate`, `Not validated`,
`Run validation before preview or apply`, the authenticated trade-bonus
unavailability phrases, and
`src/features/architect/tradeMachine/TradeEditor.tsx`. The only exact current
defect match was the paused closure lane; path-only results were unrelated older
issues. No exact open repair existed, so BZE-296 was created as the sole High,
In Progress child blocking that lane.

The [completed visible-verdict foundation](https://linear.app/bzero/issue/BZE-247/trade-verdict-first-class-visible-per-team-reasons-reachable)
remains Done. Its recorded scope established the reusable verdict treatment but
did not cover empty `teamResults` as a validation-currentness discriminator.

## Required proof

| Risk | Discriminating proof | Expected result |
| --- | --- | --- |
| Current top-level Needs input authority is discarded | Complete validation for the exact draft with `legal: false`, a Needs input reason, and empty `teamResults` | Existing verdict, readiness, summary, and validation surfaces show Needs input and the reason |
| The real trade-bonus exclusion is hidden or accidentally authorizes mutation | Reproduce the governed nonzero trade-kicker case with unavailable authenticated allocation evidence and instrument every write boundary | Honest existing trade-bonus reason is visible; preview and Apply are unavailable; batch, Team, event, receipt, and history write counts remain zero |
| Empty per-Team results are treated as universally incomplete | Return a generic completed top-level blocked result with empty `teamResults` and an exact draft key | The generic reason remains visibly blocked without invented per-Team results |
| Missing or incomplete validation looks current | Exercise no result, cleared result, thrown/failed authority construction, missing completion identity, and result without an explicit legal verdict | Every case remains Not validated; no old reason, preview, or Apply authority appears |
| A stale result survives draft edits | Validate, then change Teams, players, entitlements, cash, salary-matching choices, and other draft-key inputs one at a time | The prior authority is invalidated and hidden immediately |
| Reset or Team replacement preserves old authority | Validate, then reset the trade or replace/remove a Team | The prior result and recorded identity are cleared; status is Not validated |
| Normal per-Team paths regress | Exercise legal, illegal, warning, and supported results with nonempty `teamResults` | Existing presentation, preview, and Apply behavior remains unchanged |
| Apply is merely permanently disabled | Run a supported legal control through preview and Apply, then leave, return, reload, and compare its receipt/history across touched Teams | Apply enables only for the exact current legal authority; persistence, reload, receipt, history, and cross-Team state agree |
| Direct mutation bypasses UI gating | Invoke the mutation path with the empty-Team blocked result and inject counters before every commit/write site | Mutation rejects before the first write, independent of button state |
| A completed but malformed result is accepted | Supply an exact draft key with malformed top-level authority, ambiguous legality, or an unresolved validation promise | Result remains Not validated and cannot preview or Apply |

## Validation contract

- Focused hook currentness and stale-draft tests.
- Focused Trade Machine/UI verdict and validation-state tests.
- Real trade-bonus no-write and direct-mutation guard tests.
- Reset/Team-change tests and supported per-Team controls.
- Supported legal preview/Apply/persist/reload/receipt/history control where
  applicable.
- `npm run typecheck`, `npm run build`, and the closest approved scoped/diff
  suites, all under the four-minute ceiling.
- Complete non-retained Trade Machine browser diagnostic before freeze.
- One Graphify update after source topology is stable.
- Retained 1280x720 exact-head certification only after the candidate is clean,
  pushed, and frozen.
- Exact-head hosted CI and every available automated-review finding settled
  before the independent-Claude prompt is generated and mechanically verified.

## Explicit exclusions

- Ordinary trade-bonus calculation, inference, allocation, protection,
  amendment, prior-trade/payability, payer/reallocation, or payment timing.
- Phase 3B behavior or issue creation.
- Accepted Canon, governed source, schema, persistence, or migration changes.
- Validation or mutation-guard weakening, invented per-Team results, broad
  TradeEditor refactoring, or subjective layout/copy changes.
- Any edit, evidence change, undraft, merge, or resumption of the paused closure
  lane.
