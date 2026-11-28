# One Architect: final Sandbox and World unification plan

## Owner summary — one page

**What we are fixing.** Sandbox should be the main way someone opens Architect, sees what their team can do, makes moves and keeps planning. It must work without signup. A World adds account saving and its own ongoing history. Both must use the same NBA rules, money and starting information.

Some of that foundation already exists. The problem is that Sandbox reaches different inputs, skips some checks, blocks several tools and does not keep all the results of a move together. We will connect the existing tools to one complete basketball state and repair the actual differences. We are preserving the useful World work.

**What the finished experience does.**

- Opens on the latest maintained NBA snapshot and clearly shows its date. New Worlds use that same starting information.
- Supports every required V1 roster tool: supported trades and draft assets, signings, own free agents, options, extensions, waivers, stretch, buyouts, offer sheets, sign-and-trade and Guide.
- Gives the same answer and dollar amounts as a World given the same starting information, date and moves. A move updates every involved team.
- Keeps applied Sandbox moves on the same browser through reloads, reopening, signing in and ordinary app updates, until the user presses Reset. It never silently replaces them with newer NBA data.
- Offers **Reset to latest NBA snapshot** when the user wants a fresh start. Older Worlds and existing Sandbox work keep their own starting information.

**How we will build it.** First prove a complete trade, a second move, reload and Reset using the shared calculations and storage design. Then move the remaining tools onto that same path, removing each old Sandbox path when its replacement becomes active. Prepare and check the new starting data early. Keep the live site working while unfinished changes are being integrated.

**Rough size, including implementation, focused checks and review fixes:**

| Delivery | Planning allowance |
| --- | ---: |
| Shared starting data and the first complete, recoverable trade | 8–14 focused working days |
| Remaining trade rules and roster/contract tools | 9–16 days |
| Remaining screens, data-refresh proof and normal-site acceptance | 5–8 days |
| Initial NBA data catch-up, partly alongside the above | Provisional 2–5 days |
| **Total required work** | **24–43 focused working days; roughly 5–9 serial workweeks** |

These are estimates, not measured delivery promises. They exclude waiting for access or an approval. The first complete trade will reveal the real integration cost; update the remaining range then. Check the actual missing NBA records early and revise the catch-up allowance if needed.

**Scope stays finite.** Full local History/Compare, saving a Sandbox as a World and future-season progression remain later work. Snapshot date is already the agreed default; changing the clock does not make an old roster current. Browser storage cannot survive every browser/device deletion, but the app must have no automatic expiry or silent reset.

**Next:** Claude reviews this synthesis. No implementation or production change is authorized by this document alone. Any still-needed live installation/publication approval comes after agents prepare the exact change and rollback, using any existing approval that actually covers it.

---

## 1. Status, evidence and authority

Prepared November 28, 2026, for Claude's final review. This is the synthesized implementation proposal, not a claim that the repair is built or accepted.

The four comparison files remain unchanged: [PLAN_CODEX.md](PLAN_CODEX.md), [PLAN_CLAUDE.md](PLAN_CLAUDE.md), [REVIEW_OF_CLAUDE_PLAN.md](REVIEW_OF_CLAUDE_PLAN.md), and [REVIEW_OF_CODEX_PLAN.md](REVIEW_OF_CODEX_PLAN.md). Inputs were read together at Claude branch commit `f70efd1ca3adfb788393f9be6f9e3bdec7f3cee4`. Application source was checked against main `04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125`; that remained the live main ref during synthesis. Before implementation, inspect relevant subsequent changes rather than restarting the whole audit.

The owner's latest requirements override older wording: Sandbox is V1, requires no signup or manual sign-in, keeps applied moves through reload until Reset, and uses the same rules and money as a World. The existing [V1 contract][contract], [finish checklist][checklist], [execution plan][execution] and [BZE-243][parent] remain the product scope, status and coordination homes. When this plan is accepted, update those existing records to remove obsolete statements that reload persistence belongs only to Worlds. Do not introduce another status system.

### Resolutions from the cross-review

| Question | Final direction |
| --- | --- |
| Broad storage conversion first, or a working action first? | One complete action first, introducing the shared starting builder and a narrow document-store interface that later actions extend. |
| Must every Firestore import disappear? | No. Shared gameplay uses the agreed interface as it migrates. Saved-world administration and unrelated/post-V1 code can keep their existing services. |
| Can local records use fields named `worldId`? | Yes, with a real local scope and explicit workspace kind. A local identifier never creates account ownership or authorizes server writes. |
| Does matching World output prove correctness? | No. Require both cross-mode agreement and independently justified NBA outcomes and dollar amounts. |
| When should data become available? | Prepare and measure it early; publish and verify it before activating dependent behavior. Final acceptance remains at the end. |
| When are old paths deleted? | In each activation slice, after all its real callers move. An unfinished, disabled implementation may temporarily coexist with the still-live old route. |
| History/Compare and Save Sandbox as World? | Preserve saved-world features; keep the additional local features outside mandatory V1. |
| Which date starts Sandbox? | The release's effective snapshot date, already required by W16/S2. Supported forward planning is explicit. No new owner decision is needed. |
| Was the documented production setup approved? | The earlier Codex assertion was not substantiated by the verifiable approval record. Treat installation authority as unconfirmed; check for an actual owner approval before execution and reuse it if present. |

Two factual refinements carry into implementation. Ordinary Sandbox signing is currently blocked by the actual resolver, despite a leftover local function. Also, the regex cited in Claude's review constrains **operation IDs**, not scope/world IDs; conservative local scope naming is a design choice, not that validator's requirement. [Signing route][signing] · [Draft capability][capability]

## 2. Product boundary and user behavior

Sandbox is one coherent local league scenario, not a collection of unrelated team previews. Switching teams changes the view, not the underlying reality. A second action sees every consequence of the first. A World created from the same release starts with equivalent basketball state; different histories or explicitly selected dates can legitimately produce different later answers.

Required coverage is W2–W10 and W14 in both modes, plus the applicable cockpit/Team Plan information. Existing saved lifecycle, History and Compare remain intact. Use the proven entry points: Full Cap Table overflow for waiver variants; its own-FA rows for re-signing/absolving; Free Agency and the existing own-FA launcher into Trade Machine for sign-and-trade. Keep the present visual design. [Workflow scope and behavior standard][contract]

A tool closed by the actual calendar must remain understandable and correctly refuse the move. Lawful dated fixtures prove that the implementation works; a November snapshot does not make every offseason action legal. Missing decisive facts produce a specific needs-input result or an already accepted, named simulation assumption. Never invent unused exceptions, erase known obligations, or treat unknown money as zero.

Keep the V1 exclusions: nonzero trade-bonus calculations, poison-pill and performance-incentive salary bases, DPE, sign-and-trade with picks, four-team trades, future-season advance, Offseason room, draft-night UI, asset authoring, raw JSON entry and certified real-life historical legality. Preserve existing Two-Way trading support without adding new conversion/signing families incidentally. A reachable excluded case must stop honestly in both modes.

Local operation records are required for consistency and recovery; a full local history interface is not. Cross-device sync, cloud backup, sharing, multiple named local scenarios and undo/redo are not added by this repair. The normal signed-in World experience remains available alongside Sandbox.

## 3. One shared basketball path

### 3.1 Reuse existing computation and build equivalent starting state

Keep the existing trade preparation, normalized mutation computation, governed salary/contract/draft decisions and final-state checks. Both modes supply the same normalized basketball inputs, evaluate the same proposal, compute the complete changes and then commit through their selected storage destination. Current local trades already reach shared computation; the defects are in inputs, gates and result handling, not the absence of any real engine. [Trade action path][trade-actions] · [Normalized computation][normalize]

Extract the pure starting-document construction from existing initialization and contract-ledger building. Use one deterministic builder for metadata, 30 teams, player/Contract state, contract baseline shards, draft roots and entitlements, free-agent/rights inputs and applicable assumptions. Supply scope identity and operational timestamps explicitly. The server retains authorization, trusted source selection and lifecycle controls; the browser does not manufacture those permissions. [Contract builder and verifier][contract-source] · [Trusted initializer][initializer]

The builder has distinct input cases:

- **Fresh Sandbox or World:** the explicitly selected, verified release.
- **Restored Sandbox:** its retained release plus its complete committed checkpoint.
- **Copied World:** the parent's retained source and actual state, including changed records and pending operations. Never substitute the current release.
- **Legacy World:** its existing compatibility reader and source semantics, until a separately justified change is made.

Compare generated basketball state with a checked identity mapping. Account metadata and operational timestamps may differ; economic dates, balances, restrictions and all internal references must agree.

### 3.2 Explicit workspace context

| Context element | Required meaning |
| --- | --- |
| Kind and identity | Sandbox or saved World; stable local instance or actual saved identity. |
| Reset generation and revision | Which local incarnation is active and which committed state a proposal evaluated. |
| Source identity | Release/component versions, immutable effective date, schema and assumptions. |
| Scenario clock | Action date/instant used for eligibility, proration and deadlines. |
| View selection | Team, room and salary-view season; these do not change the action clock. |
| Basketball state | Complete logical league state, including prior actions and pending obligations. |
| Evaluation identity | Full proposal/terms, assumptions and rules/calculation version. |
| Persistence capabilities | Local or saved commit destination, separate from basketball eligibility. |

Local identity survives anonymous UID changes and sign-in/sign-out. It must not be just `sandbox-<releaseId>`: two resets to the same release are different generations. Existing schema names may remain where compatible, but truthy `worldId` must no longer imply cloud saving, account ownership or a different rule set. Keep operation IDs compatible with existing validation separately. [Same-ID loader][world-loader] · [Save-state interpretation][save-state] · [Capability checks][capability]

### 3.3 One narrow document-store interface, two implementations

Introduce the interface through the first complete trade. It covers the reads, required queries and atomic revision-checked change sets used by migrated gameplay. Use existing normalized document shapes and path helpers. Expand the same contract for subsequent actions; do not invent a persistence design per family or reproduce the whole Firebase SDK.

The saved implementation retains Firestore authorization, canonical reads, immutable roots, sanitation, revision checks and event writes. The local implementation uses IndexedDB for its retained baseline and complete changes, with atomic generation/revision comparisons. Untouched teams can resolve lazily against the same pinned baseline.

Define actual semantics before migrating a caller: missing versus deleted records, merging/updating, field removal, array additions/removals, timestamp conversion, deterministic query order and any needed paging. Support subscriptions only if a retained caller needs them; remove obsolete whole-catalog subscriptions deliberately. Test the shared semantics against both implementations. The earlier inventory omitted operations such as `arrayRemove` and `onSnapshot`; it is not a complete interface specification. [Entitlement writes][entitlement-writer] · [Player subscription][subscription]

Saved listing, creation, rename/archive/delete, account isolation and authorization stay on saved services. A signed-in visitor can use Sandbox while their World selector separately accesses account Worlds. There must be no global backend switch that accidentally redirects those services to the local scenario.

### 3.4 Dates, verdicts and currentness

Start the action date at the release's effective date. Keep it separate from source capture/publication times, viewed salary season and the wall-clock timestamp used to record an operation. Use exact instants and time zones where the accepted rule requires them; do not flatten an exact deadline into an arbitrary date-only value.

Retain supported forward movement within the current salary-cap year. Update applicable deadlines and dated state through shared logic, not merely a label. Repair the draft loader's requirement that mutable scenario date equal immutable source date while preserving its source, season, digest and custody checks. Do not rewrite a baseline date/digest to make advancing time work. Include a forward-date draft trade in acceptance. [Draft loader][draft-loader] · [Existing clock update][world-core]

Every displayed verdict, Apply and export binds to the complete context and proposal. A changed term, route, affected state, date, generation, source, assumption or calculation version makes the old result stale. Preserve editable proposals, reject late asynchronous responses and recheck at commit. A storage transaction alone does not prevent stale green results on screen. [Current draft key][draft-key]

Use five clear outcomes: legal now; illegal now; needs input; unsupported mechanism; stale/failed evaluation. Only the first enables Apply. Warnings remain nonblocking only when the action is allowed. No temporary-mode downgrade of a real NBA prohibition is permitted.

## 4. Starting releases, publication and ongoing freshness

### 4.1 Define the public gameplay representation early

Use an immutable manifest that pins compatible financial, contract, draft, free-agent/rights, calendar and assumption components. Include effective date, season, capture/publication dates, schema compatibility, component digests and provenance. Components need not become one giant document.

The browser receives the normalized inputs that rules and state builders actually need, including required evidence references and named assumptions. It must not receive credentials, user Worlds or private raw source copies by accident. The current contract verifier reconstructs records from retained artifacts, and shards contain an evidence catalog. Therefore neither “only visible screen fields” nor “publish the private package unchanged” is an adequate format definition. [Existing verification and shard construction][contract-source]

Before activation, implement and review:

1. The public schema and explicit field list for the required V1 families. Implement consumers incrementally, but account for later families' known input needs now so the first published release is not unnecessarily incomplete. Any later addition of decisive data uses a new immutable version.
2. Validation and the binding between normalized public content, its digest and the retained private source artifacts. Adapt evidence consumers deliberately; do not drop required checks to fit the download.
3. The shared builder's equivalent public/private input outcomes. Raw source verification stays in the appropriate trusted preparation path.
4. Measured compressed transfer size, parse/build time, initial local checkpoint size and actual database/network reads.
5. Applicable source/publication restrictions for that exact content. An older public June release is not permission to publish every newer private artifact.

Do not promise a 1–3 MB payload or zero database reads without measuring. Prefer immutable version URLs and bounded current-pointer caching on the existing Vercel/Firestore setup. Compatible new data should require publishing a version and moving its pointer, not changing environment digests and redeploying for every refresh. Schema, rules or calendar support changes may still require an app release.

Automatic anonymous authentication already exists. Preserve it where useful, but required local gameplay must not wait on account-world loading or demand signup. Remove unnecessary guest World-list queries and whole-player subscriptions; verify this using a fresh visitor's actual requests. Never relax private package or saved-world access to deliver public gameplay inputs. [Auth hook][auth] · [World selector][selector]

### 4.2 Pin every input that can change an answer

The release and scenario retain rosters, standard/Two-Way categories, Contracts, rights/holds, exception balances and expiry, hard-cap triggers, acquisition dates, current league figures, cash history, draft claims/restrictions and pending-action evidence.

Build an explicit dated free-agent pool and rights state. `FREE` rows can exist in the underlying contract release even though roster construction skips them; neither an expired row nor a future option proves current availability. Preserve the financial package's 30-team contract. Signing changes membership, rights and all affected books together. Pending offers retain the evidence and terms captured when created rather than rereading mutable base-player facts at resolution. [Financial builder][financial-builder]

Any new decisive source content creates a new immutable version. Do not patch release A in place as later tools migrate. A user's active A scenario is never silently upgraded or hot-rebased to B; a deliberately selected Reset starts fresh instead.

### 4.3 Preserve older saves before rotating sources

Inventory representative existing formats and their actual dependencies once, using the existing preservation work. Current sparse loaders can read parent and base teams/players; legacy draft readers also use base entitlements/pick rules, with existing append-only revision behavior that already protects some saved meanings. Freezing only two collections is not a complete guarantee. Preserve those semantics before a refresh can affect them. [Team/parent loading][team-loader] · [Draft baseline selection][draft-source] · [Entitlement resolution][entitlement-resolver] · [Pick rules][pick-rules]

Use retained releases and existing compatibility adapters where sufficient. Do not mass-migrate old Worlds or blindly freeze every collection. If a concrete format requires materialization/migration, prepare that exact case and preservation proof for the applicable authorization. A missing old version is a recovery error, not permission to use current NBA data.

Keep referenced releases available. Copies of A made after B becomes current must still carry A and the parent's simulated state. Preserve existing saved deletion/recovery fences and dependencies; source rotation must not erase or reinterpret older history.

### 4.4 Make maintenance a usable, bounded operation

The retained November 14 preparation is a starting point, not proof of today's rosters. Early in Stage 0/1, run the existing inventory/collection workflow to identify the actual gap through the chosen candidate date. Reconcile rosters, contracts and payroll together, then rights, restrictions and draft changes as applicable. The provisional 2–5-day catch-up allowance is not permission to conceal unresolved facts or start an unbounded research project.

Extend the existing [NBA maintenance workflow][maintenance] so one documented sequence prepares a candidate, reports missing/conflicting inputs, validates it, retains it privately where required, publishes the approved normalized representation and verifies actual application reads. Collection, factual acceptance, publication and working product behavior remain distinct outcomes.

Recommended operating cadence: check for material transactions on active NBA days and prepare a reconciled release when they change supported answers. Preserve the last good version if preparation fails. Show the actual date, a newer-version notice and useful loading/error states; never label stale data “today” because the page loaded today. Refresh again before final activation if the candidate has materially aged during implementation.

Measure the first catch-up and one subsequent refresh in the existing work record. Further scheduling, collection and reconciliation automation is a separate follow-on sized from those results. Reuse available scripts now; no new provider, paid feed or automated evidence-acceptance platform is assumed.

## 5. Local persistence, Reset and recovery

### 5.1 Durable applied state

Use one applied Sandbox per browser profile/site origin, shared across tabs. Tabs may keep independent staged proposals. Persist the baseline needed to reconstruct it plus every committed affected record: teams, players, Contracts, rights, draft claims, exception/cash/hard-cap changes, pending operations and operation records. An ordinary HTTP cache is not the only retained copy of a required baseline.

Apply is atomic. Compare the expected generation/revision, commit all effects and the operation record, then report success and update the visible committed state. A failed durable write preserves the last valid checkpoint and the proposal for retry; it must not look like a completed, safely retained move. Repeated requests or a lost response must recover one outcome without duplicate financial effects.

Broadcast committed changes to other tabs. A stale tab preserves its proposal, refreshes state and revalidates before applying. Use the storage transaction for exclusion; notification alone is insufficient. Do not attach local ownership to the transient anonymous UID, create server Worlds silently, or copy account-private World contents into Sandbox during sign-out.

### 5.2 Reset is an atomic replacement

Reset is the deliberate destructive action for this local scenario. Its wording must say that it clears the scenario's moves and identify the selected snapshot. Keep any ordinary destructive-action confirmation concise.

1. Fetch/locate and validate the replacement release while retaining the existing checkpoint.
2. Build the fresh state and atomically install it with a new Reset generation, even when the release is unchanged.
3. Invalidate previous proposals, ready results, in-flight work and operation identities for the active generation.
4. Notify other tabs; their old generation cannot write old moves back.
5. Retire superseded local state only after the replacement is complete.

Failed download, incompatible data or failed storage leaves the prior complete scenario intact. Test Reset against simultaneous Apply, another tab and the same release.

### 5.3 App upgrades and browser limitations

Version checkpoints. Migrate a copy when compatible, verify it, then replace the active checkpoint. Keep the original through failures. Unknown schemas or corrupt state get a recovery/error path, never automatic Reset. Ordinary app upgrades and changed anonymous credentials cannot strand valid local work.

A rules fix revalidates unapplied proposals; it does not silently replay and rewrite already applied history. Show any material scenario limitation honestly, using the existing simulation standard. Rollback compatibility includes checkpoint readers, not only the server release pointer.

Request persistent browser storage where supported and inspect the result. Denial is not itself a reason to disable otherwise working storage, but actual write/quota failures must be handled. The browser can decline persistence and can remove best-effort site data; IndexedDB cannot guarantee survival after every browser/device deletion. State this briefly in the product without requiring signup, a home-screen installation or a new backup feature. Do not promise detection of a completely erased previous session when all its records are gone. [MDN persistence API][browser-persist] · [WebKit storage policy][browser-policy]

## 6. Delivery sequence and estimates

Each stage is a coherent outcome, not necessarily one PR. Estimates include implementation, targeted checks and review fixes, assume reuse of the existing engines and #688, and exclude external waiting. Count shared work once; UI, parity tests and path removal accompany each migrated action rather than all waiting for the last stage.

| Stage | Outcome | Focused working-day range | Dependencies |
| --- | --- | ---: | --- |
| 0 | Align the existing queue and preservation cases | 1–2 | Accepted synthesis |
| 1 | Verified release, shared builder and minimal workspace/store contract | 3–5 | 0; initial source reconciliation can overlap |
| 2 | Complete player-and-pick trade, chained move and durable local recovery | 4–7 | 1's required inputs and interfaces |
| 3 | Remaining trade-rule, clock and authority differences | 2–4 | 2; relevant rules pulled into 2 immediately |
| 4 | Ordinary signings, own FAs, options/extensions and waiver families | 4–7 | Stable 1–2 contracts |
| 5 | Offer sheets and supported sign-and-trade | 3–5 | 4's contract/rights inputs; can prepare earlier |
| 6 | Remaining room, navigation, Guide and export integration | 2–3 | Relevant actions; incremental work already included above |
| 7 | Source rotation, repeatable maintenance and final normal-site acceptance | 3–5 | All required actions; safety requirements begin earlier |
| Separate factual work | Initial reconciled NBA candidate | Provisional 2–5 | Existing maintenance inventory; can overlap 0–2 |

**Total: 22–38 implementation/checking days, plus provisional 2–5 factual-refresh days.** Update the remaining estimate after Stage 2 using measured seam work, missing source inputs, storage behavior and review findings. Additional work that materially changes schedule, cost or product scope gets a plain explanation and concrete options under AGENTS.md; agents decide routine engineering changes themselves.

### Stage 0 — settle the execution record

In the existing plan/checklist/Linear children, record the four owner requirements, this sequence and the deferred optional features. Reuse existing issues for matching outcomes. Correct stale status only where verified; do not reopen completed work or create a second inventory.

Choose reusable fixtures for an untouched release, a changed current World, a representative sparse/legacy World, a copy and pending-action cases. Preserve the original fixture inclusion set and source identity; later additions are separate. Existing output is preservation evidence, not the NBA correctness oracle. Identify actual live callers of the replaced paths and the first required Canon expectations.

**Exit:** next implementation work is concrete, preservation cases exist, source catch-up gaps are bounded, and no further general audit is needed.

### Stage 1 — make one starting state possible in both modes

Define the manifest/public schema for required V1 inputs and implement the shared builder/readers needed for a complete trade, explicit workspace context and the small shared store contract. Keep existing saved initialization behavior and copy inputs. Prepare and measure the exact public candidate; verify 30-team identities, player membership, contract/financial coherence, draft state and compatible components.

Introduce server/public delivery support additively. Development can use the exact candidate without making it public. Coordinate with the ongoing #688 setup; that work need not wait for a universal store refactor or replacement of all its package selection.

**Exit:** untouched Sandbox and World basketball state agree from the same verified input; incompatible components fail clearly; private inputs stay private; representative old and copied Worlds read as before. The actual candidate and publication changes are reviewable.

### Stage 2 — prove a complete trade and recovery

Start with a supported two-team player trade, then a representative supported player-and-pick trade and a three-team routing case. Both modes use complete governed inputs, shared evaluation/computation and final checks. Fix any applicable roster/salary/date bypass now; Stage 3 is not permission to ship a known wrong first slice.

Ship complete proposal/context invalidation and commit binding for every trade activated here, including stale displayed verdicts and late responses. Later stages extend this protection to further paths; they do not supply a missing first-slice safety check.

Replace base-team reload and primary-team-only local application. Persist all affected teams/assets/ledgers together. Prove a second move, team/room navigation, saved reload and local reopen. Include first-slice checks for generation/revision conflicts, same-version Reset, Reset racing Apply, storage failure and app-checkpoint upgrade/recovery. Verify that local operation creates or writes no saved World.

Retire the superseded trade/picks-only route when the new route activates. An old global pick overlay cannot be silently merged into an unrelated new roster: preserve it until an explicit compatible transition or clear informed Reset. Never let an unmigrated action write legacy state into a new session.

**Exit:** independent rule/dollar expectations and mode parity pass, every affected room reflects the trade, invalid/stale operations have no partial effects, and reload/Reset are reliable in supported browser conditions. Re-estimate here.

### Stage 3 — finish trade correctness and date behavior

Cover the remaining supported matching, aggregation, BYC, exceptions, aprons/hard caps, cash, standard/Two-Way categories, dated roster limits and draft authority. Remove the preview-specific roster bypass and resolve world-gated input selection. Classify warning/failure policies against the accepted Canon while retaining lawful grace periods and exceptions. [Current roster bypass][cap-validator] · [Current flags][flags]

Preserve existing calendar-month aggregation and Two-Way-only/mixed lanes, including zero matching salary without fabricated TPE credit. Zero matching salary does not waive financial completeness or an existing hard cap. Complete applicable shortage/hardship and current cash findings, and keep excluded salary mechanisms as honest stops.

Extend the first slice's validation identity to remaining trade paths and complete the source-date/action-date coverage. Any forward-date path activated earlier must already satisfy that repair. July moratorium fixtures illustrate why existing expectations cannot be the sole oracle; they are not a reproduced November failure or a reason to add an unsupported July workflow to V1.

**Exit:** supported trade decisions no longer depend on saving mode, current-date boundaries have justified expected results, and source/currentness failures cannot bypass Apply or export.

### Stage 4 — migrate ordinary roster actions

Fix the actual standard-signing resolver first. Reuse the governed decision/calculation path with dated membership, terms, proration and exception selection. Then migrate own-FA re-sign/renounce, supported options/extensions and Full Cap Table waiver/stretch/buyout actions.

For each family, move its input reads, normal launcher/modal, legality, complete state effects and related room refresh together. Pin free-agent/hold evidence; update all membership and rights relationships. Retire that family's old Sandbox implementation when the replacement activates. Do not revive the detached signing executor as a second engine.

**Exit:** each family has a lawful success, relevant refusal and missing-input case, correct immediate books, local recovery/saved reload and a representative interaction with a trade. Closed calendar windows are explained without mislabeling the feature as unimplemented.

### Stage 5 — migrate pending and compound actions

Move offer creation, reservations, match/decline/finalization and exact Exercise Notice deadlines to the same context. Switching teams must retain the pending operation. Persist original evidence, source identities and terms; retries or failed intermediate stages cannot double-spend or partially change either team.

Connect the existing Free Agency and own-FA sign-and-trade launchers through Trade Machine preparation and apply, including the receiving-team restriction. Keep the no-picks V1 boundary. Resolve ARCH-060 copied pending-offer authority and mirrored-state safety; until a supported copy can preserve them, refuse before partial writes rather than pretend success.

**Exit:** lawful match/decline and supported S&T work in both modes; deadlines, retries and stale intermediate results behave correctly; pending A offers and supported A copies keep their meaning when B is published.

### Stage 6 — finish the connected product

Finish Roster, Cap Sheet, Full Cap Table, Trade Machine, Free Agency, Guide and Team Plan integration. Display the real source/action dates, current state, assumptions and **saved on this browser** versus account-saved World status in plain language. Keep saved-only History/Compare and their existing create/select entry points honest about that scope; creating a fresh World must not imply it imports local moves.

Preserve proposals through room/team/view-season changes; explicitly handle Reset and World/account transitions. Account-private data must leave the view on sign-out without deleting Sandbox work. Export all participants/assets, correct amounts and the actual proposed/applied/currentness status; separate generation time from basketball dates.

Inspect changed desktop and phone screens. Preserve the full 18-player Cap Sheet/Full Cap Table layout requirement at 1280×720. Search remaining preview/world branches and classify them: legitimate persistence/identity boundaries remain; basketball shortcuts and misleading fallback labels do not.

**Exit:** required rooms agree after chained actions, drafts are not silently discarded, exports are truthful and no required route reaches a retired path.

### Stage 7 — prove refresh and the complete deployed experience

Finish the existing maintenance sequence and the combined A-to-B preservation test. Install/publish the exact authorized candidate and verify actual reads; if an earlier action was activated, its required data was already installed and checked then. This stage is final integrated acceptance, not the first delivery of source data.

Use the normal site: a fresh visitor without signup, normal account creation of a World, local reopen/Reset, representative complete action chains, saved reload/History/Compare and second-account isolation. Verify private package denial, runtime identity, deployed Rules and applicable History index shapes using existing scoped procedures.

Keep referenced releases and existing saves through rollback. Preserve additive deletion fences and indexes while deletion work is unfinished. A pointer rollback changes new starts, not the meaning of active A/B scenarios; app rollback must still read retained checkpoints or offer honest recovery.

**Exit:** W16/S1–S4 and affected existing workflows pass in the normal product; source freshness and maintenance are demonstrated; the owner can perform final V1 hands-on acceptance. Do not mark V1 accepted on the owner's behalf.

## 7. Safe rollout between stages

Main deploys to the normal site. No merge may select an absent/incompatible release or route a real session into half-migrated state. Use additive support and a narrowly scoped rollout switch where needed; finish existing behavior until the replacement is ready. This is an implementation transition, not a new account requirement or permanent separate product.

Before each action activates: its data is installed/read back, shared evaluation and complete commit work, affected rooms consume the same state, and old callers are switched. Then remove the obsolete path in that activation slice. Preserve currently working functionality; remaining tools that were already unavailable locally must be labeled honestly until completed. All mandatory tools must work before final V1 acceptance.

Keep BZE-359/#688 progressing in its own verified scope. At synthesis, it remained an open draft at `655def839a5f96b7effb69cb9449ee12cdc16e91`, with local/review evidence and production setup/live checks pending. Its existing private-package/normal-account work is reusable; new public projection/current-pointer work is additional. [PR #688][setup-pr] · [Exact setup and rollback][setup]

The cited coordination comment does not establish owner authorization. Before a protected production action, locate the actual approval and match its scope; if absent, prepare the exact installation, public field scope, destination, configuration/Rules diff and rollback, then ask once. No generic source-terms certification, new paid service or blanket hold on implementation is required. This synthesis performs no production action and does not approve one.

## 8. Acceptance that proves the result

Start parity and independent expected-result tests in Stage 2, then extend them per action. Use the accepted Canon through `npm run architect:canon:lookup -- <LEAF>` and the current [pin instructions][canon]; the same-named historical file on main is not the accepted rulebook. Never derive expected money solely from current application output.

| Coverage | Required proof |
| --- | --- |
| Starting books | All 30 teams; roster categories, Contracts, holds, obligations, cap/tax/apron levels, exceptions and draft state match from the same release. Preserve current-estimate versus final-tax distinctions. |
| Player trades | Two/three teams, standard/Two-Way-only/mixed lanes, legal and illegal matching/roster/timing boundaries, complete effects and a chained move. |
| Draft assets | Current firsts and required ordinary seconds; protections/swaps/fallback/connected claims, custody, Stepien and freezes; no double ownership or conflicting claims. Decisive unknowns block the affected asset. |
| Exceptions, hard caps and cash | Correct use/creation/remainder/expiry and trigger history; dated cash ledgers on both sides; no double-spending or unknown-as-zero behavior. |
| Signing and own free agents | Current membership, minimum/exception route, proration, rights/holds and roster effects; refusal and missing-input cases; signing removes availability everywhere. |
| Options/extensions/waivers | Supported dates and terms, exact affected contract years, roster exit and remaining obligations; stretch/buyout facts remain honest. |
| Offer sheets and S&T | Lawful match/decline/finalization, exact deadlines, required reservations and restrictions, safe retries/copies and source-pinned pending evidence. Excluded S&T-with-picks stops. |
| Date and freshness | Forward-date draft trade, closed windows, no unsupported rewind/year crossing, view season does not change action date; changed terms/state/date/assumptions invalidate verdict/Apply/export. |
| Local recovery | Reload/reopen; same-version Reset; Reset racing Apply; multiple tabs; failed download/write/quota; duplicate request/lost response; checkpoint upgrade/incompatibility; account/anonymous-UID transitions. |
| Source rotation | A Sandbox, A World, changed A state, pending action and A copy survive B publication. A new copy of A still uses A; new B starts use B. Legacy fixtures retain their existing meaning. |
| Saved integrity/security | Existing format/copy cases, canonical saved writes and ownership, private inputs, initialization/deletion/recovery fences; local actions make no saved-world writes. |
| Product journey | Proven launchers, navigation/draft retention, full roster layouts, accurate rooms/Guide/Team Plan, complete export, saved History/Compare and real no-signup access. |

Parity compares complete meaningful state and verdicts, not only totals or green/red status. Normalize generated identifiers with a one-to-one mapping and verify dependent references. Ignore only metadata with no basketball/integrity meaning; do not discard economic dates or custody relationships to make tests pass.

Run shared store contract cases only for semantics actually used, including transactional conflict behavior. Apply focused browser checks to changed visible/saved behavior, including a representative WebKit path for the new local persistence behavior where the available test environment supports it; record any genuine coverage limit.

Follow current [AGENTS.md][agents]: affected tests, `test:diff` before PR, build/typecheck when relevant, Functions package checks for its changes, and independent review of rule, money, saving, security and accepted-source changes. Reviewers may choose additional probes for concrete risk. Do not build new certification machinery, repeat the full suite per small change or count skipped checks as passed. Keep underlying safety tests when updating obsolete world-only expectations.

## 9. Keep the existing work and deferred roadmap intact

Use the current execution plan's exact finding dispositions and existing child issues. This mapping assigns responsibility without claiming unfinished findings are already closed:

| Existing findings | Treatment |
| --- | --- |
| ARCH-001–002 | Preserve restored-main/delivery work; update the existing queue and verify normal-site integration in 0/7. |
| ARCH-003–007 | Shared dated roster/clock/signing/matching/action readiness in 1–4. Max-roster repair alone does not close shortage/hardship. |
| ARCH-008–013 | Preserve tax distinctions; finish rights/options/extensions and dated FA membership in 1/4/5. |
| ARCH-014–017 | Ordinary second-round portfolio/custody follow-through; preserve connected claims, draft/exception records and merged Compare pagination in 2/3/6. |
| ARCH-018–021 | Preserve opening obligations, stretch uncertainty, Guide policy and signed-money displays while sharing their state. |
| ARCH-022–026 | Action feedback, dialogs, retained drafts, exports and integrated acceptance in each slice and 6/7. |
| ARCH-027–035 | Atomicity/retry, copy/legacy preservation, versioning, runtime, ownership, measured capacity, independent review and owner acceptance throughout. |
| ARCH-036–041 | Keep future-season work after V1; reuse this same state/operation core when it proceeds. |
| ARCH-042–046 | Preserve deferred incentives/bonuses/poison-pill/DPE/expanded contract authoring and their current honest stops. |
| ARCH-047–052 | Keep later conversion, Ten-Day/rest-of-season, second-round signing, renegotiation, claims and additional operational depth outside this repair. Necessary current inputs still count. |
| ARCH-053–057 | Preserve later conditional cash, four-team, Offseason, draft-night and authoring scope. |
| ARCH-058–059 | Retain visible simulation assumptions and boundaries around scouting, providers, redesign and platform rewrites. |
| ARCH-060–061 | Copied pending offers and source-pinned resolution in 5, before a rotation involving them. |
| ARCH-062–063 | Current dated cash inputs/accepted assumptions and supported rare-event input combinations in 3/data work; future annual rollover stays later. |

The retained future sequence is shared annual-transition state, draft conveyance/contract carry, selected advanced mechanisms, then proof of complete multi-team progression and recovery. It is not an added V1 gate. Optional local History/Compare and session-to-World promotion get separate product/implementation decisions later, not hidden tasks in this estimate.

## 10. Final review and first implementation handoff

Claude's final review should check that the synthesis resolves the cross-review, preserves the four owner requirements, uses current scope, has no unhandled live-deployment gap, and includes the complete local/saved state and preservation cases. Report only material corrections or remaining product choices; preserve the four originals. Do not begin implementation merely because the file is named PLAN_FINAL.

After the review and owner's direction to proceed, the first implementation assignment is Stage 0 plus the minimal Stage 1/2 slice under the existing execution plan. Start from then-current main, inspect relevant changes, agree the narrow shared contracts and implement. Source preparation and #688 setup can proceed alongside under their applicable authority. Additional action families can overlap once those contracts stabilize; avoid concurrent edits to the same hooks/schemas without an assigned owner.

Use existing PRs/issues/checklist for delivery evidence. A completed action means its normal UI, rules, money, all affected state and recovery work together. A helper, schema, documentation edit or matching test total alone does not close the workflow.

### Source references

Links below pin code findings to the inspected application baseline or identify the existing operating record. Requirements stated as future work are proposed implementation decisions, not claims that current code already satisfies them.

[contract]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/docs/agent-guides/architect-v1-completion-contract.md
[checklist]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/work/architect-completion/V1_FINISH_CHECKLIST.md
[execution]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/work/architect-completion/ARCHITECT_COMPLETION_EXECUTION_PLAN.md
[parent]: https://linear.app/bzero/issue/BZE-243/architect-completion-gate-drive-v1-to-an-owner-approved-finish
[signing]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/hooks/useArchitectActions.signingExecution.ts#L537
[capability]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/draftReview/capability.ts#L149
[trade-actions]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/hooks/useArchitectActions.tradeActions.ts#L243
[normalize]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/mutationPipeline.normalize.ts#L523
[contract-source]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/contractSource/contractSourceRelease.ts
[initializer]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/functions/src/architect/initializeWorldService.ts
[world-loader]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/hooks/useArchitectState.worldLoader.ts#L194
[save-state]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/hooks/teamPlanSaveState.ts#L105
[entitlement-writer]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/entitlements/entitlementWriter.ts#L376
[subscription]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/subscribeArchitectPlayerData.ts#L76
[draft-loader]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/governedDraftWorld.load.ts#L150
[world-core]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/worldManager.core.ts#L913
[draft-key]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/tradeMachine/utils/computeTradeDraftKey.ts#L54
[auth]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/shared/hooks/useAuth.ts#L16
[selector]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/GMDashboard/components/WorldSelector.tsx#L146
[financial-builder]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/scripts/architect/buildSimulationFinancialBaseline.ts
[team-loader]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/teamLoader.ts
[draft-source]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/entitlements/draftSourceBaseline.ts#L69
[entitlement-resolver]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/entitlements/entitlementResolver.ts#L377
[pick-rules]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/entitlements/pickRulesResolver.ts#L82
[maintenance]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/docs/operations/NBA_MAINTENANCE.md
[browser-persist]: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
[browser-policy]: https://webkit.org/blog/14403/updates-to-storage-policy/
[cap-validator]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/features/architect/utils/capLegality/postStateCapValidator.ts#L815
[flags]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/src/config/validationFlags.ts#L50
[setup-pr]: https://github.com/Bet-Zero/scoutzero/pull/688
[setup]: https://github.com/Bet-Zero/scoutzero/blob/655def839a5f96b7effb69cb9449ee12cdc16e91/docs/operations/ARCHITECT_WORLD_SETUP.md
[canon]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/docs/reference/cba/README.md
[agents]: https://github.com/Bet-Zero/scoutzero/blob/04f8dde6fc1d4ad693dba5ae8c4fb6edccafd125/AGENTS.md

## Decisions for the owner

No decision is needed before Claude reviews this plan. The defaults already respect your four requirements and the agreed V1 scope.

1. **When the live change is ready, approve any installation/publication that is still unapproved.** Agents must first show exactly what NBA information will become available to visitors, what existing-site setup changes, and how it can be rolled back. Reuse an actual prior approval where it covers the work. The recommendation is the existing hosting setup, with private source copies and saved Worlds protected and no new billing.
2. **Only if preparation finds a real obstacle, choose the specific tradeoff.** For example, a required fact cannot be obtained or a particular source cannot be published in the proposed form. Agents must first bring concrete alternatives, their effect on the product and rough extra time/cost. There is no blanket request for you to certify source terms or design the technical solution.
