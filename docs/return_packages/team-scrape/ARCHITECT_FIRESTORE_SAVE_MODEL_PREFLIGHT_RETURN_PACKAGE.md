# ARCHITECT FIRESTORE SAVE MODEL PREFLIGHT RETURN PACKAGE

## 1. FIRESTORE MAP TABLE

| Purpose | Collection / Path | Doc IDs | Written by | Read by | Notes |
|--------|-------------------|---------|------------|---------|-------|
| **Base Team Data** | `architect_baseTeams/{teamCode}` | `LAL`, `BOS`, etc. | **Scraper/Admin** (ReadOnly) | `loadWorldTeamData`<br>`firebaseTeamPlanHelpers` | Source of truth for rosters, contracts, and *current* picks. |
| **Base Player Data** | `architect_basePlayers/{playerId}` | `lebron_james_123` | **Scraper/Admin** (ReadOnly) | `hydrateBaseTeam` | Detailed player bio/stats. |
| **World Metadata** | `architect_worlds/{worldId}` | `world_173...` | `createWorld`<br>`persistWorldMutation` | `getWorldMetadata`<br>`useArchitectState` | Stores `asOfDate`, `draftPositionsByYear`, owner, timestamp. |
| **World Team State** | `architect_worlds/{worldId}/teams/{teamCode}` | `LAL`, `BOS` | `persistWorldMutation` | `loadWorldTeamData` | **Copy-on-Write**. Full team snapshot (overrides base). Only exists if team is modified in world. |
| **Player Overrides** | `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` | `lebron_james_123` | `persistWorldMutation` | `loadWorldTeamData` | Individual player overrides (e.g. edited contract). |
| **Event Log** | `architect_worlds/{worldId}/events/{eventId}` | `trade_173...` | `persistWorldMutation` | *Audit/History UI* | Immutable log of mutations. |
| **Free Agents** | `freeAgents/{agentId}` | `some_guy_123` | *Legacy/Scraper* | `loadFreeAgents` | Separate global pool for FAs. |

---

## 2. CURRENT SAVE MODEL (SIMPLE ENGLISH)

1. **Base Truth**: The `architect_baseTeams` collection is the read-only foundation. It contains the "real life" state of every team, including their **current** draft picks (`draftPicksInventory` arrays).
2. **World Store (Copy-on-Write)**:
    * When you create a world, it is effectively "empty" of team data. It just points to base.
    * When you **modify** a team (e.g., trade a player), the system reads the *current* state (base + existing world changes), applies the change, and then **writes the ENTIRE team object** to `architect_worlds/{worldId}/teams/{teamCode}`.
    * Unchanged teams are never written to the world; they are just loaded from base.
3. **Draft Picks**: Currently, picks are just arrays of objects *inside* the Team Document (`draftPicksInventory`, `draftPicksObligations`). If a pick moves, **both** involved team documents must be fully rewritten in the world scope.
4. **Metadata Fields**:
    * `asOfDate`: The "world time" (SSOT Phase 20).
    * `draftPositionsByYear`: Stores manual drift of draft order (e.g. tanking results) directly in the world metadata doc.
    * `lastModifiedTeams`: Array of team codes modified in the last action.

---

## 3. DIFF/OVERRIDE MECHANISM

The system does **not** store diffs (e.g. "Draft Pick X moved to Team Y").
It stores **Snapshots**.

* **Logic**: `loadWorldTeamData(worldId, teamCode)`
    1. Check `architect_worlds/{worldId}/teams/{teamCode}`.
    2. If exists, return it (it is the full authoritative state for that world).
    3. If not, look for `parentWorldId` and repeat.
    4. If no parent/snapshot, load `architect_baseTeams/{teamCode}`.

* **Merge**: There is no "merging" of fields. If a world has a team snapshot, that snapshot **completely replaces** the base team.
  * *Exception*: Player overrides (individual player docs) are merged *into* the team roster during loading.

---

## 4. DRAFT PICKS CURRENT SOURCE-OF-TRUTH

* **Location**: `draftPicksInventory` (and `Obligations`, `Contested`) arrays inside the **Team Document**.
* **Source Code**: `src/features/architect/utils/firebaseTeamPlanHelpers.js` (lines 164-173).
* **Implication**: There is currently **NO** central "Entitlements" collection. Picks are treated as properties of a Team. To trade a pick, you must mutate the Team.

---

## 5. RISKS / GAPS

1. **Monolithic Team Docs**: Since picks are inside the Team Doc, trading a single 2nd round pick requires reading, deserializing, modifying, and rewriting the **entire** Team object (all players, cap holds, dead cap, etc.). This is heavy and risk-prone for concurrency.
2. **Duplication**: If we implement proper "Entitlement Assets" (Phase 8), keeping them inside Team Docs means we are duplicating the "Asset" data in every snapshot.
3. **No Single Ledger**: You cannot query "Where is Pick X?" without iterating through all teams in the world (or trusting a potentially stale index).
4. **Incompatibility with Phase 8**: The Phase 8 plan (Entitlements) creates 480+ distinct asset objects. The current save model has no "home" for these except stuffing them into the Team Doc arrays.

---

## 6. RECOMMENDATION: PHASE 9 PLAN

**Do NOT switch to a fully separate Entitlements collection yet.**
The "Copy-on-Write" Team Snapshot model is deeply ingrained (`teamLoader`, `mutationPipeline`, `useArchitectState`).

**Best Path Forward (Safe & Fast):**

1. **Embed Entitlements in Team Docs**: Replace the `draftPicksInventory` (legacy) array with a new `entitlements` array in the Team Document.
2. **Generate on Fly**: When loading a Base Team, use the Phase 8 Generator to compute the `entitlements` array from the ledger (or store pre-computed in base).
3. **Trade = Move Asset**: When trading, simply move the `EntitlementAsset` object from Team A's `entitlements` array to Team B's `entitlements` array.
4. **Benefits**: Keeps the existing "Atomic Team Write" model working without writing new loaders.

*Future Optimization*: Later, move `entitlements` to a subcollection `architect_worlds/{worldId}/entitlements` if team doc size becomes an issue (~50-100kb is fine for now).
