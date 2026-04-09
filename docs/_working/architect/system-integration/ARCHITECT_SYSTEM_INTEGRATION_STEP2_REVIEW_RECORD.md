# ARCHITECT SYSTEM INTEGRATION — STEP 2 REVIEW RECORD

## Step
Step 2 — Cross-Surface Handoff Integrity

## Purpose
Review whether major Architect surfaces hand state and truth to one another cleanly, explicitly, and honestly.

This step is not a local feature audit. It is a cross-surface handoff review focused on contracts between feature surfaces.

## Executive Verdict
**RISK**

Architect’s major handoff seams are mostly real and functional, but they are not equally explicit. Several high-value cross-surface contracts are coherent in practice while still being too implicit, too dense, or too unevenly expressed across the repo.

The biggest Step 2 conclusion is:

> The system mostly connects correctly, but the repo still communicates some feature-to-feature contracts unevenly. Certain seams are self-explanatory, while others work only if the contributor already knows how the underlying action or reload path behaves.

This is not a failure of basic architecture. It is a handoff-clarity and contract-durability risk.

---

## Scope Reviewed
This review focused on cross-surface handoff seams between major Architect features, including:

- dashboard/world shell ↔ feature sections
- cap sheet ↔ adjacent current-season authority surfaces
- cap sheet ↔ free agency / trade / contract modal shared helpers
- trade machine ↔ authoritative apply/mutation results
- offseason ↔ season/world aftermath surfaces
- free agency ↔ world-only lifecycle/persist surfaces
- league/roster/history-style consumers ↔ upstream world/team truth
- shared contract/cap helper surfaces ↔ feature consumers

## Live Files Reviewed
- `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V3.md`
- `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md`
- `src/features/architect/GMDashboard/GMDashboard.tsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/sections/CapSheetSection.tsx`
- `src/features/architect/GMDashboard/sections/TradeSection.tsx`
- `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`
- `src/features/architect/GMDashboard/sections/OffseasonSection.tsx`

---

## Exact Cross-Surface Handoff Map

### 1. Dashboard shell → state/actions → feature sections
`GMDashboard.tsx` acts as the composition shell. It does not own feature truth directly. Instead, it routes:

- read-side coordination through `useArchitectState.ts`
- action/mutation orchestration through `useArchitectActions.ts`
- bounded props into section wrappers for each major dashboard tab

This is the main top-level handoff surface for Architect.

### 2. Read-side handoff: authorities → dashboard adapter → sections
`useArchitectState.ts` explicitly consumes the read stack through world/data loaders and turns that into dashboard-visible state:

- active world state
- world metadata
- team snapshot
- players map
- world-mode boundaries
- reload hooks

This is a strong handoff because it does not rebuild lower-level truth locally.

### 3. Write-side handoff: feature UI → actions adapter → authorities → reload
`useArchitectActions.ts` acts as the main cross-feature action routing seam.

It receives UI intent from sections and modals, routes committed mutation writes through the mutation authorities, and then re-applies committed truth back into dashboard state using reload/sync helpers.

This is the central handoff seam for:
- free agency
- trade machine
- contract actions
- manual cap-sheet ledger mutations
- offer sheet lifecycle actions

### 4. Cap sheet shell → primary cap-table surface + adjacent current-season authority surface
`CapSheetSection.tsx` explicitly distinguishes:

- shell-selected year truth
- the primary selected-year cap sheet surface
- the adjacent current-season exception / TPE / hard-cap surface
- DEV-only fixture controls outside authoritative feature truth

This is one of the clearest handoff surfaces in the repo.

### 5. Trade section wrapper → TradeEditor
`TradeSection.tsx` is a very thin prop-forwarding wrapper into `TradeEditor`.

This handoff is functionally simple, but the boundary contract is mostly implicit. It forwards:
- team identity
- cap projections
- current year
- players map
- apply callback
- primary team snapshot
- edit-contract callback
- world context inputs

The seam works, but the wrapper itself does not explain much about the contract.

### 6. Free agency section → action owner / lifecycle owner / pool
`FreeAgencySection.tsx` is a medium-thin wrapper, but the contract it forwards is denser than it looks.

It receives:
- free agent pool data
- an `actionOwner` object from upstream
- incoming/outgoing offer sheets
- players map

It then mediates:
- free-agent pool actions
- offer-sheet lifecycle actions
- world-only gating behavior

The section itself is reasonably clean, but the underlying handoff contract is dense and easy to underestimate.

### 7. Offseason section → world-backed advance surface / draft-position persistence / optional preview surface
`OffseasonSection.tsx` is a meaningful handoff seam. It explicitly separates:

- world-backed season advancement
- committed aftermath application
- draft-position persistence authority
- world reload after season advance
- DEV-only non-authoritative offseason preview

This is a good example of honest handoff design: persisted world advancement is not presented as the same kind of surface as preview-only offseason logic.

---

## What Is Coherent

### 1. Dashboard shell ownership stays bounded
`GMDashboard.tsx` still behaves like a composition shell instead of turning into a feature authority.

### 2. Read-side and write-side adapters are clearly split
`useArchitectState.ts` owns dashboard-visible read coordination while `useArchitectActions.ts` owns UI mutation orchestration.

That separation is healthy and gives the rest of the dashboard a consistent entrypoint pattern.

### 3. Offseason world advancement handoff is honest
The world-backed offseason surface, draft-position persistence seam, and optional DEV preview are clearly distinct.

This is one of the better examples of cross-surface contract honesty in the repo.

### 4. Cap sheet section communicates its adjacent-surface contract unusually well
`CapSheetSection.tsx` clearly communicates the boundary between:
- selected-year cap table truth
- adjacent current-season authority surfaces
- dev-only fixture support

That is exactly the kind of explicit cross-surface contract Step 2 wants.

### 5. World-only action gating is intentionally surfaced rather than hidden
Free-agency lifecycle actions and world-backed offseason flows are not silently treated like local/no-op operations when a world is absent. The repo is trying to make that boundary visible.

---

## What Is Weak / Risky

### 1. Cross-surface contract explicitness is uneven
Some seams are very clearly expressed, especially:
- `CapSheetSection.tsx`
- `OffseasonSection.tsx`

Other seams, especially `TradeSection.tsx`, are little more than prop tunnels with minimal explanation.

That unevenness is itself a Step 2 risk because contributors will get different levels of contract clarity depending on which surface they happen to inspect.

### 2. Free agency depends on a dense upstream `actionOwner` contract
`FreeAgencySection.tsx` looks simple, but it depends on a complicated upstream contract from `useArchitectActions.ts`, including:
- dual-path signing
- world-only actions
- modal availability
- offer-sheet lifecycle availability
- disabled reasons
- lifecycle routing

This is coherent, but it is also easy for downstream surfaces to over-assume or misuse because the contract is heavy and indirect.

### 3. Trade machine → authoritative apply/mutation path remains a high-risk handoff seam
The trade surface receives several world/context/state inputs from the shell while the authoritative apply path lives deeper in `useArchitectActions.ts`.

This seam is not clearly wrong, but it is large and loaded:
- UI trade data is transformed into mutation payload shape
- world vs base mode is resolved inside the action layer
- authoritative compute/apply and local base-mode validation both exist
- the result is then resynced back into dashboard state

That makes this one of the strongest candidates for Step 2 execution attention.

### 4. World-only and preview-only gating is honest but distributed
The repo is trying to keep world-only actions honest, but the contract is expressed across:
- section wrappers
- action owners
- modal availability
- lifecycle availability
- disable messaging

That distribution is not inherently wrong, but it increases the chance that one surface will drift from another.

### 5. Some handoff seams are clearer in comments than in structure
This is subtle but real.

The repo increasingly documents cross-surface ownership well, but Step 2 is not only about whether comments are good. It is about whether feature-to-feature contracts are easy to understand and hard to misuse from structure plus behavior.

Some seams have both.
Some still rely too much on contributor discipline.

---

## Strongest Step 2 Handoff Surfaces

### A. Dashboard shell ↔ `useArchitectState.ts` / `useArchitectActions.ts`
This is the strongest top-level system handoff in the repo.

### B. Read stack ↔ dashboard-visible state
The dashboard read seam remains disciplined and does not appear to reconstruct lower-level truth.

### C. Offseason world advancement ↔ committed aftermath reload/application
This is one of the cleanest integrated feature-to-feature handoff surfaces.

### D. Cap sheet selected-year surface ↔ adjacent current-season surface
This seam is explicit, bounded, and unusually well explained.

---

## Highest-Risk Step 2 Handoff Surfaces

### A. Trade Machine ↔ mutation/apply result contract
This remains the highest-risk handoff seam reviewed in Step 2.

### B. Free Agency ↔ upstream `actionOwner` contract
The handoff is coherent but dense and too easy to underread.

### C. Section-wrapper consistency across the dashboard
The repo does not yet express wrapper-level handoff contracts with the same clarity across all dashboard sections.

---

## Preliminary Decomposition Read for Execution
The live Step 2 seams suggest the following likely execution lanes:

### SI-2A — Normalize shell-to-section handoff clarity across major wrappers
Focus on uneven wrapper-level contract expression.

### SI-2B — Clarify Free Agency ↔ `actionOwner` contract boundaries
Focus on making the dense upstream action contract easier to read and safer to consume.

### SI-2C — Clarify Trade Machine ↔ authoritative apply/mutation result handoff
Focus on the highest-risk handoff seam in Step 2.

### SI-2D — Tighten world-only / preview-only gating contracts across section surfaces
Focus on keeping feature surfaces honest and aligned about what persists, what previews, and what is unavailable without an active world.

---

## Final Conclusion
Architect’s cross-surface handoffs are not broken.

The problem is not that features are secretly disconnected.
The problem is that the repo still expresses some of the most important feature-to-feature contracts too unevenly:
- some surfaces are explicit and easy to reason about
- some surfaces are dense and indirect
- some surfaces are structurally thin enough that the contract is only obvious if the reader already knows the system

That is why Step 2 is **RISK**, not **FAIL**.

The repo is ready to continue, but Step 2 execution should focus on tightening the most important handoff seams rather than doing broad cleanup.
