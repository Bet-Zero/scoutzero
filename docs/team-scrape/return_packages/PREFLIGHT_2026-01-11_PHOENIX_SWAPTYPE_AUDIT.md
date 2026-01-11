# PREFLIGHT — Phoenix Team Code Canonical + SwapType Semantics Audit

**MODE:** PREFLIGHT (no code changes)
**DATE:** 2026-01-11
**MASTER DOC:** `docs/team-scrape/DRAFT_PICKS_PIPELINE.md`

## Summary

This preflight audit identifies a **critical PHX vs PHO conflict** between the UI subsystems and the draft-picks pipeline, and documents the `swapType` semantic gap between the scraper and UI schemas.

---

## 1) Phoenix Canonical Decision (PHX vs PHO)

**Decision:** The Repo Canonical Phoenix code is **PHX**.

### Evidence

The UI/Frontend definitions are authoritative and consistently use **PHX**.

* **Subsystems Assuming PHX:**
  * `src/constants/teamList.js` (L165): `code: 'PHX'`
  * `src/shared/utils/formatting/teamLogos.js` (L92): `PHX: 'suns'`
  * `src/features/architect/utils/teamLoader.js` (L140): `'PHX'`
  * `team-scrape/shared/ledger/buildPickLedger.ts` (L130): `ALL_TEAM_CODES` includes `'PHX'`

* **Subsystems Conflicting (Using PHO):**
  * `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` (L68): Defines `'Phoenix Suns': 'PHO'`
  * `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` (L263): Explicitly normalizes `PHX: 'PHO'` with comment `// Phoenix: RealGM uses PHX, we use PHO` (Incorrect assertion)

---

## 2) Conflict Map

If the draft-picks pipeline continues to output **PHO**, the following systems **will break**:

| Impact Area | Severity | Breakage Details |
| :--- | :--- | :--- |
| **Team Logos** | 🔴 CRITICAL | `TradePickRow.jsx` passes `originalTeam` ('PHO') to `TeamLogo`. `TeamLogo` uses `teamLogos.js` map which ONLY has 'PHX'. **Result: No logo renders for Phoenix picks.** |
| **Ledger Generation** | 🔴 CRITICAL | `buildPickLedger.ts` iterates `ALL_TEAM_CODES` (containing 'PHX'). It will look for `by_team/PHX.json` but find nothing, or fail to bin 'PHO' picks into the 'PHX' view. |
| **Pick IDs** | 🔴 HIGH | Downstream systems expecting canonical IDs (e.g. `PHX_2027_1st`) will not match `PHO_2027_1st`. |
| **Swap Partners** | 🟡 MEDIUM | `tradeHelpers.js` looks up swap partner names. 'PHO' will not map to a detailed team object in `TeamMap`. |

---

## 3) Draft Picks Pipeline Output Code

The Draft-picks pipeline currently emits Phoenix as **PHO**.

**Location:** `team-scrape/draft-picks/scripts/realgm_draft_picks.ts`

* **`CODE_VARIANTS` Map (L263):** Explicitly maps `PHX: 'PHO'`.
* **`teamCodeFromName` function:** Uses `CODE_VARIANTS` to force normalization to PHO.
* **`INTERNAL_TEAM_CODE_MAP` (L68):** Maps 'Phoenix Suns' directly to 'PHO'.

**Output Artifacts:** Any generated JSON from this script (`draft_picks_PHO.json`) currently contains `originalTeam: "PHO"`.

---

## 4) swapType Consumer List

Audit of consumers for `swapDetails.swapType` (from pipeline) vs `swapType` (UI Schema).

* **Pipeline Definition:** `bilateral` | `multiway` | `favorable` | `unknown`
  * *Source:* `realgm_draft_picks.ts`, `buildPickLedger.ts`
* **UI Schema Definition:** `best_of` | `worst_of`
  * *Source:* `src/schemas/architect.ts`, `TradePickRow.jsx`

**Consumers:**

* **`src/features/architect/tradeMachine/TradePickRow.jsx`** (L148)
  * **Expects:** `best_of` | `worst_of`
  * **Usage:** Controls the "Best of/Worst of" dropdown state.
* **`src/features/architect/utils/tradeHelpers.js`** (L324)
  * **Expects:** `best_of` | `worst_of` derived from data.
  * **Logic:** `const type = pick.swapType || (pick.swapDetails?.favorable === 'least' ? 'worst_of' : 'best_of');`
* **`src/tests/tradeMachine/swapResolution.test.js`**
  * **Expects:** `best_of` | `worst_of` for resolution logic.

**Unused Data:**

* `swapDetails.poolTeams` and `swapDetails.allocation` are **NOT consumed** by any UI file in `src/`.

---

## 5) swapType Recommendation

**Recommendation:** **Normalize: if poolTeams/allocation exist => swapType='multiway'** (in Pipeline) but **Keep UI `swapType` separate.**

The pipeline and UI use `swapType` for different semantics (Structure vs. Logic).

1. **Pipeline (`swapDetails.swapType`):** Keep using `bilateral`, `multiway`, `favorable`. This correctly describes the *contract structure*.
2. **UI (`swapType` root property):** Keep using `best_of`, `worst_of`. This correctly describes the *selection mechanic*.
3. **Bridge:** `tradeHelpers.js` already bridges this successfully by looking at `pick.swapDetails?.favorable`.

**Action Items:**

* **Do NOT** force the scraper to output `best_of`. The scraper should describe the text it sees ("most favorable", "swap with").
* **Do NOT** change the UI to `multiway`. The UI just needs to know who wins.
* **Future:** If `poolTeams` support is added to UI, logic in `tradeHelpers` can be updated to handle `multiway` structure specifically.

---

## STOP CONDITION CHECK

* [x] Phoenix Canonical Decision: **PHX** (`teamList.js`, `teamLogos.js` authoritative).
* [x] Conflict identified? **Yes**, pipeline outputs **PHO**.
* [x] swapType normalization? **No change needed**, current mapping in `tradeHelpers` works.
