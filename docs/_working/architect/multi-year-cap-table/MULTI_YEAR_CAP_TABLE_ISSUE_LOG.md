# MULTI-YEAR CAP TABLE — ISSUE LOG

## Purpose

Problem-level issue history for the Multi-Year Cap Table Truth Pass.
Issues describe underlying system problems, not action task titles.
Status and resolution history are tracked per issue.

---

## STEP 1 — Top-Level Ownership, Year Selection, and Surface Boundary Truth

### MYCT-1-1 — The top-level cap-table shell mixes multi-year totals viewing with current-year-only adjacent authority in a way that can create year-truth ambiguity

**Status:** RESOLVED
**Substep:** MYCT-1A

**Problem:**
The Multi-Year Cap Table shell presents as one unified feature surface, but internally it carries two different kinds of truth simultaneously: multi-year cap-table viewing driven by `selectedYear`, and current-year-only adjacent authority for hard-cap, exception, and TPE truth. The boundary is disclosed via `ExceptionTracker`'s fail-closed panel, but the shell-level year-truth model is still split rather than unified. A user navigating to a future year encounters one cap-table shell where some parts remain authoritative and others deliberately stop being authoritative, without that distinction being clearly signaled at the top-level feature shell. This creates a year-truth ambiguity risk that lives above the component level.

**Resolution:**
`CapSheetSection.tsx` now owns one explicit shell-level year-truth panel that shows both the selected cap-table season and the adjacent current-season authority season. The primary cap-sheet surface and its child totals/detail regions now read as selected-year surfaces rather than current-year surfaces, while `ExceptionTracker.tsx` keeps the future-year fail-closed boundary with clearer adjacent current-season authority wording.

**Files implicated:**

- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`

---

### MYCT-1-2 — Top-level ownership boundaries between `CapSheetSection.tsx`, `CapSheet.tsx`, and adjacent surfaces are broader and less explicit than ideal

**Status:** RESOLVED
**Substep:** MYCT-1B

**Problem:**
`CapSheetSection.tsx` functions as the dashboard handoff but owns more than a thin passthrough: it holds `selectedYear` state, manages the sync reset from `currentYear`, controls DEV fixture panel exposure, and defines the split between the primary cap-sheet surface and the adjacent exception surface. `CapSheet.tsx` is the true main composition/control surface, but because `CapSheetSection` retains these responsibilities, the ownership contract between the two layers is broad rather than minimal. The story of "who owns what" at the top level is understandable but not as explicit as it needs to be — meaning future changes may widen the wrong layer without a clear structural signal.

**Resolution:**
`CapSheetSection.tsx` now reads as the dashboard orchestration seam: it owns `selectedYear`, shell-level year-truth signaling, the explicit split between the primary selected-year surface and the adjacent current-season authority surface, and the DEV-only fixture controls as a separate support surface. `CapSheet.tsx` remains the main cap-table composition/control owner, and it now publishes its child surface labels into `CapSummaryTiles.tsx` instead of leaving that ownership implicit. `ExceptionTracker.tsx` receives its surface label from the section layer so the adjacent surface reads as a named handoff rather than a competing top-level owner.

**Files implicated:**

- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`

---

### MYCT-1-3 — There are no focused guardrails pinning selected-year handoff behavior or current-year-only adjacent surface boundary truth at the top-level shell

**Status:** RESOLVED
**Substep:** MYCT-1C

**Problem:**
The top-level shell contract is honest but has no durable guardrails protecting it from silent drift. Specific failure modes exist with no dedicated coverage: future-year viewing could stop presenting current-year-only authority limits clearly; section-level `selectedYear` ownership could drift; `ExceptionTracker` could gradually act as a multi-year authoritative surface without loud test failures; DEV fixture panel wiring or handoff boundaries could shift in ways that weaken the intended shell contract. Because this shell defines how every deeper cap-table seam is initially interpreted, undiscovered drift here risks invalidating assumptions across all later Multi-Year Cap Table truth-pass steps.

**Resolution:**
This execution added a dedicated Step 1C shell guardrail pass. A new focused runtime guardrail test now pins section-level `selectedYear` ownership, `selectedYear <- currentYear` reset behavior, current-year vs future-year shell messaging, adjacent-surface prop handoff, and DEV fixture separation as a distinct support surface. The existing closure gate was also tightened to pin the source-level contract directly: explicit shell-year-truth copy, label handoff from `CapSheetSection.tsx` to `ExceptionTracker.tsx`, label handoff from `CapSheet.tsx` to `CapSummaryTiles.tsx`, and DEV fixture controls staying on a named support surface rather than inside authoritative regions.

**Files implicated:**

- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.tsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`

---

---

## STEP 2 — Canonical Multi-Year Totals Engine and Threshold Source Truth

### MYCT-2-1 — The yearly threshold gateway still behaves like a mixed resolver and can under-report mixed-source reality in its metadata summary

**Status:** RESOLVED
**Substep:** MYCT-2A

**Problem:**
`capRulesProfile.ts` is correctly positioned as the single gateway for yearly cap, tax, apron, exception, and rookie-minimum truth — but it still functions more like a resolution engine than a clean declarative source. Yearly truth is assembled from cap settings, constants, imported projections, and conditional fallback logic. Rookie-minimum values can resolve through recursive projection when direct per-year values are absent. The most significant reporting weakness is that `_meta.sourcesSummary` defaults to a single summary label derived from a top-level `defaultSource`, but individual threshold fields may have actually resolved from different source types. The summary can therefore describe mixed-source resolution as if it came from one source, which under-reports the real provenance picture. The totals SSOT downstream is only as trustworthy as this threshold input layer, and that layer is not yet fully clean or maximally honest in its self-reporting.

**Resolution:**
`capRulesProfile.ts` still owns yearly threshold resolution, but it now resolves rookie-minimum fallback through one explicit bounded helper and computes field-level provenance before summarizing it. The metadata model now reports a conservative `sourcesSummary` based on the worst active source tag, exposes `sourcesMixed`, `sourceTags`, and `fieldsBySource`, and records the exact rookie-min resolver path plus the cap-settings source/tag. Mixed-source years no longer flatten to a single optimistic summary label, while the yearly gateway remains intact.

**Files implicated:**

- `src/features/architect/utils/capRulesProfile/capRulesProfile.ts`
- `src/tests/architect/utils/capRulesProfile.test.ts`

---

### MYCT-2-2 — The canonical totals authority seam still carries bounded legacy dead-money compatibility and adjacent snapshot/overlay shaping inside the same file as the pure totals owner

**Status:** RESOLVED
**Substep:** MYCT-2B

**Problem:**
`computeTeamCapTotals.ts` is the explicit canonical totals owner, but the authority seam has widened beyond pure totals ownership. Dead-money resolution inside the file still carries a compatibility stack: canonical `deadCap` arrays take priority, but the engine also handles object-map `deadCap` compatibility, and falls back to older ledgers — `waivedContracts`, `stretchHistory`, and flat `deadMoney` maps — when canonical coverage is absent. That compatibility logic is intentional and bounded, but it still lives inside the same file as the core totals authority. Additionally, `resolveHardCapOverlay(...)` and snapshot shaping logic sit alongside the pure totals compute functions, meaning the file simultaneously owns totals computation and adjacent state-shaping responsibilities. This blurs what is purely canonical compute truth versus what is compatibility shim or downstream adapter work, making the authority seam harder to reason about and easier to widen incorrectly over time.

**Resolution:**
`computeTeamCapTotals.ts` remains the SSOT for canonical totals math, but the bounded compatibility and adjacent shaping work now sit in tiny support helpers around it instead of inside the core authority block. Dead-money compatibility moved into a dedicated canonical-first helper that preserves `deadCap` precedence and only falls back to legacy ledgers when the canonical field has no coverage for the selected year. Hard-cap overlay normalization likewise moved into a downstream snapshot helper so snapshot creation reads as SSOT consumption rather than as a competing totals owner.

**Files implicated:**

- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
- `src/features/architect/utils/capTotals/deadMoneyForYear.ts`
- `src/features/architect/utils/capTotals/hardCapSnapshotOverlay.ts`
- `tests/computeTeamCapTotals.test.js`
- `src/tests/architect/capTotals/deadMoney.test.js`
- `src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.js`

---

### MYCT-2-3 — There are no focused guardrails protecting the canonical totals SSOT, threshold provenance behavior, or bounded legacy compatibility behavior against silent drift

**Status:** RESOLVED
**Substep:** MYCT-2C

**Problem:**
The canonical totals engine and threshold gateway are the compute foundation for the entire Multi-Year Cap Table feature, but neither has dedicated guardrails protecting the behaviors that matter most for multi-year truth. Specific unprotected drift vectors include: yearly threshold provenance could become less honest without failing any existing test; the canonical-first dead-cap preference could silently regress and allow legacy ledgers to widen their coverage beyond bounded fallback; snapshot helpers could drift toward partial recomputation rather than purely consuming the SSOT; future-year totals could accidentally pick up current-year assumptions introduced by adjacent surfaces; and the source-summary metadata could drift further from actual field-level provenance without triggering a loud failure. Because these compute paths are upstream of every cap-table consumer, drift here risks corrupting the multi-year truth model for all later review steps without an obvious failure signal at the point of introduction.

**Resolution:**
This execution added one dedicated Step 2 closeout guardrail file that pins both the source-level seam and the runtime contract. The source scan now protects `capRulesProfile.ts` staying the yearly threshold gateway, `computeTeamCapTotals.ts` continuing to route rules through that gateway plus the end-year cap-holds wrapper, snapshot/derived helpers continuing to consume `computeTeamCapTotals(...)`, and bounded legacy dead-money compatibility remaining contained in `deadMoneyForYear.ts`. The runtime guardrails now pin conservative `sourcesSummary` behavior relative to active source tags, mixed-source field visibility, legacy-threshold vs projection-chain rookie-min provenance, canonical-first dead-money precedence with bounded fallback only when canonical coverage is absent, selected/end-year truth for players/dead money/cap holds/incomplete charges, and stale stored totals losing to canonical snapshot output. Step 2 now has explicit failure points at the compute seam rather than relying on indirect downstream regressions.

**Files implicated:**

- `src/tests/architect/myct_step2_guardrails.test.ts`

---

---

## STEP 3 — Contract-Year Slicing, FutureContract Integration, and Player-Year Cap Hit Truth

### MYCT-3-1 — `futureContract` overlap precedence is governed by a thin implicit heuristic rather than a clearly owned contract-year merge rule

**Status:** RESOLVED
**Substep:** MYCT-3A

**Problem:**
`contractUtils.ts` owns the merged player-year contract stream, but same-year conflict resolution between base contract rows and `futureContract` / extension rows is handled by a compact binary rule: if an extension or future row exists for a given year, it takes precedence over the non-extension row. This may be correct for the current data model, but the rule is thinly encoded for a high-impact seam. There is no stronger rule surface explaining overlap semantics — the precedence is effectively implicit. For a player-year money path that feeds canonical totals downstream, this under-explained rule creates a soft spot where future changes could silently alter extension-season behavior without clear failure signals.

**Resolution:**
`contractUtils.ts` now normalizes each row with one explicit source owner: `playerContract`, `primaryContract`, or `futureContract`. Same-year conflict resolution moved into one named merge helper with an explicit ownership contract: player-contract rows beat `primaryContract` fallback rows, and `futureContract` rows explicitly own overlapping years over any non-future row. The merge still stays centralized in `contractUtils.ts`, but the precedence model now reads as an owned rule surface rather than as a thin implicit "extension wins" branch.

**Files implicated:**

- `src/features/architect/utils/contractUtils.ts`
- `tests/contractSeasonHelpers.test.ts`

---

### MYCT-3-2 — Years-remaining display fallback and minimum-contract cap-hit handling are softer than the multi-year truth model they belong to

**Status:** RESOLVED
**Substep:** MYCT-3B

**Problem:**
Two parts of the player-year contract seam still feel less grounded than the broader multi-year system around them. `getYearsRemainingDisplay(...)` prefers row-based truth but retains legacy fallback paths — including free-agency-year arithmetic from contract and bio fields — that can silently diverge from row truth when rows are incomplete but legacy metadata is stale. Minimum-contract cap-hit handling is explicit, but it depends on `player.isMinimum`, years-of-service thresholds, and a hardcoded minimum-cap-hit helper rather than reading as a year-aware rules consumer in the same way Step 2's totals engine does. Neither issue is obviously broken, but together they leave the player-year seam softer and less internally consistent than the canonical totals system that consumes it.

**Resolution:**
`getYearsRemainingDisplay(...)` now treats merged row truth as authoritative whenever any normalized contract rows exist, including returning `0` when the selected year has no remaining rows instead of reviving stale legacy metadata. Legacy `yearsRemaining` and free-agency-year fallback now run only when row truth is absent entirely. `getPlayerCapSheetAmountsForYear(...)` also now applies veteran-minimum reimbursement only when a selected-year contract slice exists, and it resolves that reimbursement from season-aware minimum-salary rules instead of a single hardcoded cap-hit constant. Downstream totals still consume that same player-year seam, and focused parity tests now pin both the row-first fallback boundary and the selected-year cap-hit behavior.

**Files implicated:**

- `src/features/architect/utils/contractUtils.ts`
- `tests/contractSeasonHelpers.test.ts`
- `src/tests/architect/capSheetFull_ssot_parity_guardrails.test.js`

---

### MYCT-3-3 — There are no focused guardrails protecting contract-year merge behavior, futureContract precedence, years-remaining truth, or player-year cap-hit adjustments against silent drift

**Status:** RESOLVED
**Substep:** MYCT-3C

**Problem:**
`contractUtils.ts` is the real owner of the player-year contract seam and feeds both cap-table display and canonical totals, but its key behaviors have no dedicated guardrails protecting them from silent regression. Specific unprotected drift vectors include: same-year `futureContract` overlap precedence changing without a loud failure; years-remaining logic leaning more heavily on legacy fallback paths because rows degraded; minimum-contract cap-hit handling drifting away from the intended reimbursement rule model; player-year truth diverging from canonical totals expectations; and row-merge behavior becoming harder to reason about without explicit failure surfaces. Because Step 3 cleans up the player-year money seam, Step 3 must also leave behind durable guardrails so later review steps are not auditing downstream consumers against weakened or undiscovered player-year truth drift.

**Resolution:**
This execution added one dedicated Step 3 closeout guardrail file that pins both the source-level seam and the runtime contract. The source scan now protects `contractUtils.ts` staying the merge and cap-hit owner, explicit `futureContract` / `playerContract` / `primaryContract` precedence remaining visible in source, season-aware veteran-minimum routing continuing through the shared minimum-salary helper, and `computeTeamCapTotals.ts` continuing to consume selected-year cap-hit truth through `getPlayerCapHitForYear(...)` instead of becoming a competing owner. Runtime guardrails now pin duplicate same-source stability, `futureContract` precedence, `playerContract` over `primaryContract` when no future row overlaps, extension-season exposure through `getContractYearSlice(...)`, row-first years-remaining behavior with `0` returned when row truth exists but no future/current rows remain, fallback-only legacy years-remaining/free-agency arithmetic when rows are absent entirely, two-way zero-cap-hit behavior, veteran-minimum reimbursement only when a selected-year slice exists, shared-helper minimum-cap-hit parity, and downstream `playersTotal` alignment with the same selected-year player-year cap-hit model.

**Files implicated:**

- `src/tests/architect/myct_step3_guardrails.test.ts`

---

---

## STEP 4 — Multi-Year Consumer Surfaces and Current-Year-Only Boundary Truth

### MYCT-4-1 — The UI still presents selected-year canonical viewing and current-year-only adjacent authority as a single cap-sheet experience in a way that can be overread

**Status:** RESOLVED
**Substep:** MYCT-4A

**Problem:**
The cap-sheet feature asks one visible experience to carry two distinct authority classes simultaneously: selected-year canonical cap-table viewing, and adjacent current-year-only truth covering exceptions, hard-cap status, and TPE eligibility. The feature does disclose this split — via `ExceptionTracker`'s future-year fail-closed boundary panel, disabled controls, and inline notes — but the disclosure is reactive rather than structural. The user enters a single cap-sheet surface and must notice the boundary signals to understand that future-year viewing is not authoritative for exception / hard-cap / TPE truth. For a feature whose value partly depends on multi-year reading, this creates an overread risk: the cap-sheet can be navigated to a future season and still present an adjacent exception/authority strip that reads as part of the same unified truth, even though it has been quietly fail-closed. The two authority classes are not yet easy to distinguish at a glance without reading the boundary notes.

**Resolution:**
`CapSummaryTiles.tsx` now opens with one explicit selected-year canonical-totals banner that names both the canonical totals season and the hard-cap badge authority season. `CapSheet.tsx` now keeps the selected-year dead-money control and the current-season-only exception control in visibly separate groups, so the primary cap-table surface no longer reads like one undifferentiated authority strip. `ExceptionTracker.tsx` now presents an explicit current-season authority banner during current-year viewing and a stronger future-year fail-closed panel with selected-year-vs-authority-season chips when viewing a future year. The selected-year consumer story and the current-year-only adjacent authority story now read as different truth classes at a glance rather than mainly through reactive notes.

---

### MYCT-4-2 — Consumer ownership boundaries across summary, supporting detail, control, and adjacent surfaces are softer and more blended than their intended roles require

**Status:** RESOLVED
**Substep:** MYCT-4B

**Problem:**
The consumer layer is structurally sound, but several surfaces sit close enough together that their authority roles blur in practice. `CapSummaryTiles.tsx` is labeled as a canonical totals consumer but also reaches into `teamCapSheet` for adjacent hard-cap presentation via `getHardCapStatus(...)`, mixing two reading modes in one surface. Supporting detail rows and totals breakdown occupy the same visual frame as summary tiles, making it easy for either to drift toward semi-owning totals explanations. The control strip mixes dead-money mutation entry points with current-year-only exception actions, which are conceptually different authority classes. `ExceptionTracker.tsx` depends on several adjacent utilities to function as a presentation surface, making its consumer boundary wider than its stated role suggests. None of these are obviously wrong, but the combined consumer story is softer than ideal: future changes could widen any of these surfaces beyond their intended authority without a clear structural signal or loud failure.

**Resolution:**
`CapSheet.tsx` remains the main selected-year composition surface, and it now resolves the adjacent hard-cap presentation before handing it to `CapSummaryTiles.tsx`, so the summary tiles stay a clearer canonical-totals consumer instead of reaching back into `teamCapSheet` themselves. The selected-year roster/detail frame now carries explicit supporting-detail copy, and the breakdown block now names itself as a canonical-totals consumer of the same selected-year totals authority as the summary tiles. The control strip is now split into a selected-year mutation entry point for dead money and a current-season-only adjacent authority group for exception editing. `ExceptionTracker.tsx` remains the adjacent current-season authority surface, but its banner/fail-closed copy now makes it clearer that it owns hard-cap, exception, and trade-exception presentation without competing for selected-year totals ownership.

---

### MYCT-4-3 — There are no focused guardrails protecting canonical consumer boundaries, the future-year fail-closed adjacent boundary contract, or the UI signals that communicate current-year-only authority

**Status:** RESOLVED
**Substep:** MYCT-4C

**Problem:**
The consumer-layer authority model is honest but has no durable guardrails protecting it from silent drift. Specific unprotected drift vectors include: summary consumers beginning to recompute totals rather than reading the canonical totals input; the future-year fail-closed boundary in `ExceptionTracker.tsx` softening into partial future-year presentation without a loud failure; boundary notes, disabled states, and authority badges falling out of alignment with actual action/state truth; supporting-detail surfaces drifting toward semi-owning totals explanations in inconsistent ways; and control surfaces mixing or widening authority beyond bounded mutation entry points. Because the consumer layer is where the user forms their practical truth model of the feature, undiscovered drift here risks misleading users about future-year authority without any failure signal in the underlying compute layers. Step 4 needs to leave behind durable guardrails, not only a one-time review result.

**Resolution:**
This execution added one dedicated Step 4 closeout guardrail file focused on the live consumer/UI seam without widening back into production redesign. The new guardrails now pin the source-level ownership contract directly: `CapSheet.tsx` remains the selected-year composition owner that computes canonical totals once and hands adjacent hard-cap presentation into `CapSummaryTiles.tsx`; `CapSummaryTiles.tsx` remains a canonical totals consumer rather than a recompute owner; `ExceptionTracker.tsx` remains the current-season-only adjacent authority surface with an explicit future-year fail-closed panel; and the split control strip in `CapSheet.tsx` keeps selected-year dead-money mutation separate from current-season-only exception authority. Runtime coverage now also proves the user-facing contract: selected-year canonical banners and totals stay aligned across summary and breakdown consumers, current-season authority banners stay present and accurate during current-year viewing, future-year viewing hides hard-cap badge truth, future-year exception editing fails closed, and the adjacent surface swaps to its current-season-only boundary panel instead of silently leaking future-year hard-cap / exception / TPE authority.

**Files implicated:**

- `src/tests/architect/myct_step4_guardrails.test.tsx`

---

---

## STEP 5 — Manual Mutation / Edit Surface Truth for Dead Money and Exceptions

### MYCT-5-1 — The dead-money edit surface still uses a flat full-replacement model that can silently lose canonical multi-season grouping and shape truth on save

**Status:** RESOLVED
**Substep:** MYCT-5A

**Problem:**
`ManageDeadMoneyModal.tsx` flattens canonical dead-cap entries into one editable UI row per season and then reconstructs one canonical dead-cap entry per UI row on save. This is a conservative and honest approach — the modal explicitly warns that saving replaces the team's entire dead money ledger — but it is also structurally lossy. Original multi-season grouping across a single dead-cap entry is not preserved. Richer original entry structure beyond `playerId`, `playerName`, and per-row season amount is not preserved cleanly. Notes fields are replaced with a generic `'Manual Adjustment'` label. The result is that saving through the edit surface can transform a canonical grouped ledger into a flatter one-row-per-entry ledger without signaling that shape information was discarded. Because dead-money feeds the canonical totals engine directly, this structural loss at the edit seam is a risk for multi-year cap-table truth quality over time.

**Resolution:**
`ManageDeadMoneyModal.tsx` still presents an honest manual override / full-replacement ledger, but flattened rows now retain a source group key when they come from the same canonical dead-cap entry. Save reconstruction groups those source-linked rows back into one canonical `amountByYear[]` entry, preserves allowed source metadata such as `originalSalary`, `waiveDate`, and `notes` when present, and keeps unrelated newly added manual rows distinct to avoid accidental merging. Focused modal/schema tests now assert that grouped canonical rows survive a modal save as one multi-season dead-cap entry while manual rows without a source group remain separate.

**Files implicated:**

- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.tsx`
- `src/tests/architect/capSheet_exception_wiring.behavior.test.jsx`
- `src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.js`

---

### MYCT-5-2 — The exception edit surface still behaves more like a narrow current-season state serializer than a clearly bounded canonical exception editor with an explicit ownership contract

**Status:** RESOLVED
**Substep:** MYCT-5B

**Problem:**
`ManageExceptionsModal.tsx` is cleaner than the dead-money modal, but its save semantics are still state-shaped rather than patch-shaped. The modal builds a save payload only for exception types where `enabled` is true or `usedAmount > 0`, omitting disabled zeroed entries silently. The ownership contract — that this modal is replacing canonical current-season exception state for the covered exception types — is honest in the UI copy but still somewhat implicit in the saved payload structure. Future-year views are correctly fail-closed, and the modal is correctly built around `currentYear`, but the distinction between "replacing the current-season state for these types" and "partially patching whatever is currently saved" is not structurally legible from the save model alone. For an edit surface whose authority is intentionally bounded to current-season only, that implicit contract is a soft spot.

**Resolution:**
`ManageExceptionsModal.tsx` now builds its save payload through an explicit owned current-season snapshot helper for the canonical non-TPE exception keys (`mle`, `tpmle`, `bae`, and `room`). Each persisted entry is shaped as canonical current-season state with `enabled`, `available`, `totalAmount`, `maxAmount`, `amount`, `usedAmount`, `remainingAmount`, `seasonKey`, and optional `notes`; stale stored `seasonKey` values are rewritten to the active current-season key on save. Omitted disabled zero-usage owned buckets now read from source as intentional clears for that bounded current-season key set, while existing downstream mutation semantics continue preserving non-editable buckets such as TPE and DPE. Focused modal tests now assert the richer owned payload and current-season season-key rewrite.

**Files implicated:**

- `src/features/architect/capSheet/modals/ManageExceptionsModal.tsx`
- `src/tests/architect/capSheet_exception_wiring.behavior.test.jsx`

---

### MYCT-5-3 — There are no focused guardrails protecting dead-money shape preservation, exception save semantics, replacement-vs-scope honesty, or current-season-only edit boundaries against silent drift

**Status:** OPEN
**Substep:** MYCT-5C

**Problem:**
Both manual edit modals sit directly on top of the cap-sheet SSOT and can undermine multi-year cap-table truth even if the compute layer remains correct. Current unprotected drift vectors include: dead-money flattening behavior becoming more lossy without a loud failure; dead-money replacement semantics drifting away from the modal warning copy without detection; exception save payloads losing alignment with canonical current-season exception ownership without an obvious breakage signal; current-year-only exception editing boundaries softening in source or UI without a clear structural failure; and the modal copy that explains replacement vs current-season-only behavior becoming stale without being caught. Because these edit surfaces are the primary path through which manual corrections enter the canonical data model, undetected drift at this seam can corrupt cap-table truth in ways that appear structurally valid to downstream consumers.

---

_Issue log tracks problem-level root causes. Execution substeps and status tracking live in MULTI_YEAR_CAP_TABLE_REVIEW_TRACKER.md._
