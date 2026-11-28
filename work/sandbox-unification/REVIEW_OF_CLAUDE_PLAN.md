---
name: REVIEW_OF_CLAUDE_PLAN.md
description: Independent Codex review of Claude's Sandbox unification proposal against current ScoutZero source and the owner's settled requirements.
---

# Review of Claude's Architect unification plan

Reviewed November 28, 2026.

- **Claude plan:** [PLAN_CLAUDE.md at ee7bb6d](https://github.com/Bet-Zero/scoutzero/blob/ee7bb6db300ba135541a1463e0be863da3ed68ef/work/sandbox-unification/PLAN_CLAUDE.md). That branch adds only the plan to main `04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125`.
- **Independent Codex plan:** [PLAN_CODEX.md at a7d35a2](https://github.com/Bet-Zero/scoutzero/blob/a7d35a274bb5f812738823944f1037bebe1728e8/work/sandbox-unification/PLAN_CODEX.md), committed and read back before reading Claude's plan. Only the owner's new guest-access and persistence requirements were incorporated before saving it. This review identifies further changes I would make to my own proposal; it does not retroactively incorporate them.
- **Review boundary:** source and plan review. Neither plan was implemented. Claude's plan was not edited. The architecture recommendations below are judgments, distinguished from verified code findings.

## 1. Summary for the owner

The plans are close on the product: one accurate Architect, current dated NBA data, no signup, local moves kept until Reset, and saved worlds protected from later real-NBA updates. The single most important difference is how much infrastructure changes before Sandbox becomes useful: Claude first replaces the way much of Architect reads and writes data, while my plan first completes a working trade through the shared calculations and then expands through the other actions.

I recommend the smaller, action-by-action route, using Claude's shared starting-state builder and durable browser storage where they simplify it. Claude's storage approach is viable; it needs explicit handling of dates, ownership, Reset and existing rule differences, so the promise that the rest runs unchanged is too strong. I would also move my proposed Save this session feature off the required V1 path and keep both plans' optional additions separate.

**Disposition:** retain the core proposal, with the corrections below before it becomes the implementation contract. No new owner decision is needed on V1 inclusion, signup, persistence until Reset, or equal rules and money; those are settled.

## 2. Agreements

- **There should be one set of basketball calculations.** Reuse the existing governed salary, contract, trade and draft work. A temporary workspace should receive complete inputs and apply complete results.
- **Both modes should start from the same dated release.** Pin the compatible roster, contract, financial, draft, free-agent and assumption inputs. A newer release should start new scenarios and be offered through Reset; it should not silently change an active scenario.
- **Temporary state must represent all affected teams.** A local trade cannot update only the viewed team. Contracts, rights, exceptions, cash, hard caps, pending offers and draft claims must move together.
- **Free agents and pending offers need versioned inputs.** The live player catalog must not change the meaning of an offer that has already been created.
- **Reload must retain a complete local scenario until Reset.** Claude's IndexedDB proposal is a useful concrete implementation option. Local persistence and account-owned world saving remain distinct.
- **Existing saves must retain their source meaning.** Neither approach should migrate all old worlds as a shortcut, or replace an older world's missing inputs with the latest NBA release.
- **Parity needs lasting tests.** Both approaches should run the same supported actions against temporary and saved contexts. This is necessary, alongside independent rule and money expectations.
- **Use the current infrastructure and existing product.** Keep normal GitHub-to-Vercel delivery, proportionate testing, explicit assumptions and the existing interface. A new provider or paid platform is not a prerequisite.

## 3. Disagreements

### A. The initial implementation boundary

**Claude's approach:** convert all 37 identified Firestore-importing Architect files to a common document-store interface before switching Sandbox over. A browser implementation then imitates the required query, transaction and batch behavior.

**My reasoning:** a document-shaped local store could preserve substantial working code. The existing contract-ledger builder already accepts a scope ID, and ordinary governed draft evaluation can run in the client. Using a real local scenario ID in an existing field named `worldId` is not inherently wrong.

However, the all-files conversion also includes saved-world management, authoring and future-season machinery. It makes a broad persistence refactor a prerequisite for the first useful local action. A store wrapper alone also does not resolve account-world UI, action availability, stale results or the clock conflict described below.

**Choice:** adopt the shared deterministic starting-state builder, existing normalized document shapes and durable browser storage. Introduce the smallest scenario read and commit interfaces needed for a complete player-and-pick trade, a second move, reload and Reset. A small document layer can implement those interfaces. Expand through required actions as they migrate; do not require zero Firestore imports everywhere in Architect as the V1 gate.

Keep saved-world creation, deletion, ownership and account-world listings explicitly attached to their saved services. A signed-in visitor can use Sandbox while the world selector still needs to read their saved worlds; a global “current backend” switch would route that incorrectly. [World selector](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/components/WorldSelector.tsx#L146) · [Local-compatible contract builder](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/contractSource/contractSourceRelease.ts#L245)

### B. What proves the rules and money are correct

**Claude's approach:** unchanged existing suites plus a Sandbox-versus-world parity harness establish that the modes agree.

**My reasoning:** shared code can reproduce a shared mistake. Current code contains explicit advisory settings, and one existing test expects its moratorium example to remain legal with warnings. This is evidence that unchanged suites are not a sufficient NBA-correctness oracle. It does not mean every warning is wrong; applicable grace periods and exceptions still need their proper treatment. [Timing settings](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/config/validationFlags.ts#L50) · [Existing timing expectation](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/tests/trade/timingEnforcement_authoritative.test.ts#L147)

**Choice:** require parity tests and independently justified rule/dollar cases from the accepted Canon. Cover lawful and prohibited moves, decisive unknowns, current exclusions and chained consequences. Normalize generated identities through a checked one-to-one mapping and verify their references; do not simply remove IDs before comparing states.

The lasting guarantee must include correct basketball behavior, not only equal outputs.

### C. A release ID is not enough to identify a local scenario

**Claude's approach:** `sandbox-<versionId>` preserves world-ID comparisons; local transactions preserve stale-tab protection; Reset deletes the browser layer.

**My reasoning:** the release identifies the starting NBA data, not which local scenario is currently active. Resetting to the same version would reuse the ID. Existing loaders and asynchronous guards deliberately do nothing when that ID does not change. Ownership and save-status code also interpret a world ID as an account-owned save. [Same-ID load shortcut](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/hooks/useArchitectState.worldLoader.ts#L194) · [Async identity guard](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/hooks/useArchitectState.worldTracker.ts#L74) · [Saved-status assumption](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/hooks/teamPlanSaveState.ts#L105)

**Choice:** explicitly represent workspace kind, stable local instance identity, source version, state revision and Reset generation. Keep local identity independent of changing anonymous/account authentication. A storage namespace may retain the old field names, but its meaning and routing must be explicit.

Persistence until Reset is required. Claude's “storage unavailable: starts fresh with a note” is an honest degraded-state idea, but it cannot be the successful persistence acceptance case or silently discard an existing checkpoint. Retain the last valid checkpoint, show a failed durable save and permit retry. Normal refresh must never become an implicit Reset.

### D. Local History and Compare versus saving the session as a world

**Claude's approach:** include full History and Compare in Sandbox; defer Save this Sandbox as a world until after V1.

**My approach:** keep full History and Compare world-only under the current contract, but include a proposed session-to-world bridge in Stage 6.

**Choice:** keep required local operation records for correctness, recovery and future reuse. Keep full local History/Compare and promotion out of the mandatory consolidation path unless the owner explicitly adds them.

I would adopt Claude's scheduling restraint on promotion. My plan identifies it as proposed, but its numbered stage and acceptance matrix make it look required; that needs correction in synthesis. Claude's full local History/Compare is likewise an additional product choice. Neither choice should follow automatically from which storage adapter is used. The current contract explicitly reserves W12 and W13 for saved worlds. [Current workflow scope](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/docs/agent-guides/architect-v1-completion-contract.md#L103)

### E. Source refresh and preservation

**Claude's approach:** publish immutable versions behind a current pointer; later stop refreshing two shared base collections to preserve old worlds.

**Choice:** adopt the version pointer for compatible data releases and the deliberate no-rebase behavior. Complete dependency preservation before the first source rotation.

Freezing teams and players alone does not protect all older-world inputs. Legacy draft rights and pick rules have additional base dependencies; some worlds also depend on ancestors. Preserve the existing append-only draft revision behavior where it already protects older clients, rather than assuming every source needs a blanket freeze. Section 5 identifies the actual readers.

The shared builder must also retain two distinct inputs: a fresh world starts from a selected release; a copy starts from its parent's retained source and state. The current initializer already preserves the parent's contract roots. Do not feed a copy from the new `current` pointer. [Copy initialization](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/functions/src/architect/initializeWorldService.ts#L513)

### F. Delivery order and approvals

Claude's step 1 combines the existing normal-world setup with a new public release format and pointer. The documented BZE-359 setup already has owner authorization; the new publication changes are additional concrete work. Reuse the existing authorization and identify only the additional scope when it is ready. Do not impose a blanket hold on PR #688 simply because a later change will replace its package selector. [Recorded setup coordination](https://github.com/Bet-Zero/scoutzero/pull/688#issuecomment-7238254123)

I also would not treat the 6–8 week duration or 1–3 MB public download as measured constraints. They are estimates. Prove the first complete operation and measure the actual normalized payload before committing to the broader store migration or refining the remaining estimate.

## 4. What each plan caught that the other missed

### Claude caught or made more concrete

1. **Automatic anonymous authentication already exists.** My original plan did not identify it and treated guest activation too much as an undecided access-policy choice. The current owner direction settles the product requirement, and the existing auth hook is useful starting work. No signup does not require removing invisible anonymous authentication throughout ScoutZero. [Existing anonymous sign-in](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/shared/hooks/useAuth.ts#L16)
2. **A shared starting-document builder is a concrete reuse opportunity.** Claude names the existing ledger construction and proposes extracting the server initializer's pure document-building parts. My release/context proposal was less specific about that seam.
3. **Existing world-shaped records can be useful locally.** My warning against fake world IDs should be interpreted narrowly: do not pretend a local scenario is a server-authorized saved world. A legitimate local namespace in existing normalized schemas is a reasonable compatibility choice.
4. **Durable IndexedDB storage and a store contract suite.** Claude is more concrete about browser persistence and testing a shared storage contract. Those are useful additions if the chosen adapter exposes those semantics.
5. **Optional promotion can wait.** Claude's deferral helps keep the current repair finite. I would remove promotion from my proposal's required V1 sequence while retaining its future design notes.

### My plan caught or covered more fully

1. **The actual ordinary-signing dispatch failure.** A detached local function is not a working user workflow.
2. **Independent NBA expectations alongside parity.** Equal results alone cannot establish correct rules or money.
3. **Source date versus scenario date.** The existing governed draft loader rejects a later scenario date even though same-season date controls can advance it. A storage change reproduces that conflict unless it is repaired. [Draft date gate](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/governedDraftWorld.load.ts#L164) · [Current date update](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/worldManager.core.ts#L913)
4. **Complete action and UI migration.** Own-free-agent rows, hold resolution, normal sign-and-trade launchers, option availability, draft retention, Guide and exports need explicit checks beyond removing world-only gates.
5. **Validation freshness.** Complete proposal terms, scenario identity, source version, date and state revision must bind both the displayed verdict and Apply authority. [Existing draft identity](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/tradeMachine/utils/computeTradeDraftKey.ts#L54)
6. **Preservation across source rotation.** Older sparse formats, retained source versions, copied worlds and pending offers need explicit combined cases.
7. **The existing completion work.** My mapping retains the 63 ARCH findings, current exclusions and completed improvements so consolidation does not obscure unfinished second-round coverage, dated roster behavior or current cash inputs.

These are differences in coverage, not reasons to combine every optional feature from both plans into V1.

## 5. Factual errors

The following correct claims about the current code or claims presented as necessary consequences. Proposed architecture is not classified as false merely because it is not implemented.

### F1 Plain Sandbox signings currently use the older local route

**Claude:** survey item 2 groups plain signings with trades on the older, looser path.

**Actual code:** `resolveStandardSigningExecutionRoute` always returns the world executor; that executor rejects a missing world. The old local function exists but is not selected by that route.

**Correction:** ordinary signing is presently blocked by dispatch without a world. Migrate the actual normal entry point and retire the unused local route after replacement. [Resolver](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/hooks/useArchitectActions.signingExecution.ts#L537) · [Rejection](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/hooks/useArchitectActions.signingExecution.ts#L201)

### F2 Accurate checks run only inside saved worlds

**Claude:** the owner introduction and survey describe accuracy as confined to worlds and imply that changing storage leaves the remaining behavior unchanged.

**Actual code:** local trade apply already invokes the shared mutation computation and checks its validated result. Saved apply reaches the same underlying normalized computation. The divergences are specific input selection, rule activation, final checks and application of results.

**Correction:** describe those concrete differences. Neither “Sandbox has no real checks” nor “saved worlds are already a complete correctness oracle” is supported. [Local computation and validation](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/hooks/useArchitectActions.tradeActions.ts#L243) · [Saved computation](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/mutationPipeline.ts#L490)

### F3 Free agents are absent from all starting data

**Claude:** survey item 7 says free agents are not in the starting data because the financial builder skips `FREE`.

**Actual code:** the team-roster assembly skips `FREE`, but the package can embed the underlying full contract release, including its records. The real missing product input is a complete, dated free-agent and rights pool wired into gameplay and pending actions.

**Correction:** build that explicit pool without inventing a 31st team or assuming every raw `FREE` record is an eligible free agent on the scenario date. [Roster filtering](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/scripts/architect/buildSimulationFinancialBaseline.ts#L119) · [Embedded contract release](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/scripts/architect/buildSimulationFinancialBaseline.ts#L268)

### F4 Freezing two base collections guarantees every older world stays unchanged

**Claude:** the legacy-world table and step 7 make this guarantee for `architect_baseTeams` and `architect_basePlayers`.

**Actual code:** legacy entitlement readers also use shared base entitlements; pick-rule readers use shared base pick rules. Existing draft-source envelopes select protected legacy fields for saved worlds. Sparse team/player resolution can also consult a parent.

**Correction:** preserve all existing gameplay dependencies and version-selection behavior. Freezing two collections is a partial mechanism, not proof of complete preservation. This does not automatically require a migration. [Entitlement dependency](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/entitlements/entitlementResolver.ts#L377) · [Pick-rule dependency](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/entitlements/pickRulesResolver.ts#L82) · [Legacy revision selection](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/entitlements/draftSourceBaseline.ts#L69) · [Team and ancestor loading](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/teamLoader.ts#L91)

### F5 The listed Firestore subset is complete enough for the stated unchanged conversion

**Claude:** survey item 6 lists reads, queries, transactions, batches and several field operations; step 3 removes every direct Architect Firestore import without changing behavior.

**Actual code:** the targeted set also includes `onSnapshot` and `arrayRemove`. The player subscription is only scheduled for deletion in step 5, so step 3 cannot preserve it using only the stated interface. Query document IDs, paging and update semantics also need precise contracts.

**Correction:** inventory the operations actually needed by the chosen first slice and later conversions. Either support a behavior explicitly or retire its caller deliberately. I am not disputing the rough runtime-file count or claiming that a browser implementation is impossible. [Subscription](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/subscribeArchitectPlayerData.ts#L76) · [Array removal](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/entitlements/entitlementWriter.ts#L376)

### F6 Saving a local scenario necessarily requires the server to recheck every move

**Claude:** owner decision 4 says promotion needs the server to re-check every move.

**Actual code:** current ordinary world mutation computation and validation run in frontend code, with separate trusted initialization and persistence protections.

**Correction:** promotion requires a defined canonical validation and persistence boundary. Server replay is one possible new design; it is not an existing architectural requirement. Deferring an optional promotion feature is still reasonable. [Current mutation entry](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/mutationPipeline.ts#L334) · [Computation](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/mutationPipeline.ts#L490)

### Claims checked and retained with the right limits

Automatic anonymous authentication, the arbitrary-scope contract builder, the whole-player subscription and the current package-size cap are real. They support Claude's reuse direction. They do not by themselves prove a working signed-out journey, the final public payload size, or zero database reads per visitor.

Ordinary governed draft review runs locally through the capability and baseline review functions. The separate draft-review HTTP route must not be mistaken for a required server gate on every ordinary SIMULATION trade. [Ordinary preview](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/governedDraftWorld.preview.ts#L54) · [Local capability evaluation](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/draftReview/capability.ts#L149)

The “no per-visitor database reads” promise is an acceptance target requiring explicit routing: the world selector currently queries account worlds whenever it has a user ID, including anonymous identities. A new cached snapshot endpoint alone does not establish that target. [Background world listing](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/components/WorldSelector.tsx#L146)

## 6. Risks or open questions neither plan handles well

### Atomic Reset and baseline recovery

Neither plan fully specifies what happens if Reset overlaps an Apply, another tab or a failed download.

Require this sequence: prepare and validate the replacement release; atomically install it with a new scenario generation; invalidate older proposals and async operations; notify other tabs; then discard superseded local state. If preparation or storage fails, keep the previous complete checkpoint. A stale tab must not restore pre-Reset moves.

Persist or reliably retain the baseline needed to reconstruct the saved local overrides. An evicted HTTP cache or unavailable old release must produce a recoverable error, not an empty new session.

### The exact public gameplay format

Both plans say “public view” or “safe gameplay projection” without fully defining what existing evidence consumers will accept.

The current contract-release verifier hashes raw retained artifacts and reconstructs normalized records from them; baseline shards also carry an evidence catalog. Therefore “only the fields visible on screen” may omit required rule inputs, while publishing the entire private source package is not justified. [Source verification](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/contractSource/contractSourceRelease.ts#L112) · [Shard evidence](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/contractSource/contractSourceRelease.ts#L296)

Define the normalized public schema, necessary provenance/assumptions, its digest and its relationship to retained private evidence. Let the common builder consume that validated representation. Preparing the publication contents and checking the applicable source restrictions is agent work; bring the owner a concrete decision if a real conflict remains, rather than asking them to certify unspecified source terms.

### App upgrades while a local scenario exists

Persistence until Reset must survive ordinary app updates as well as reloads. Specify checkpoint schema compatibility, controlled local migrations, rules/calculation version changes and recovery of unsupported old checkpoints. Keep the original checkpoint until a migration succeeds. A newer app must not silently erase the session because its schema changed.

Separately distinguish revalidating an unapplied proposal from rewriting already applied simulation history.

### Authentication changes without losing local ownership

An anonymous UID can change, and a visitor can sign in after planning locally. Existing governed preparation checks `createdBy` against the current user identity. Both approaches need an explicit local ownership policy that preserves the local scenario through this transition while keeping saved-world authorization intact. [Current ownership comparison](https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/draftReview/capability.ts#L158)

Test guest start, applied moves, reload, sign-in/account transition, continued local actions and deliberate switching to a saved world. Do not solve this by silently creating a server world or weakening saved access checks.

### Release compatibility and cached current pointers

Moving a small current pointer can avoid deployments for compatible NBA data changes. It cannot make arbitrary new schemas, seasons or unsupported rules work without matching application changes.

Specify atomic publication, compatible client versions, current-pointer cache freshness, retained immutable release caching and rollback to a compatible app/release pair. Keep old source versions available to existing worlds and local scenarios. A copy of an A world made after B becomes current must still use A's retained parent inputs.

### Delivery size and optional scope

Both proposals need a first implemented slice to validate the remaining effort. Avoid combining Claude's full local History/Compare, my promotion feature and a universal persistence refactor into one enlarged V1 requirement.

The first delivery should prove a supported player-and-pick trade, a chained move, correct independent expectations, reload, same-version Reset, stale-tab rejection and unchanged saved-world behavior. Its results should determine how much abstraction the remaining action families actually need.

**Recommended next step:** synthesize the agreed implementation plan from these corrections, retaining explicit unresolved choices only where they materially change the product. Keep the two original plans and this review intact as the comparison record.
