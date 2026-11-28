---
name: PLAN_CLAUDE.md
description: Claude's independent plan for making Sandbox and saved worlds one product (V1 decision 7 / W16). Written for cross-review with PLAN_CODEX.md; not yet the agreed plan.
---

# One Architect, with or without saving: Claude's plan

Status: proposal for cross-review (owner process, November 28, 2026). Codex
writes `PLAN_CODEX.md` independently. Each reviews the other once, Codex
merges, Claude reviews the merge, and remaining disagreements go to the owner
as plain choices. Nothing here is approved for building yet.

## For the owner, in one page

**The goal.** Sandbox is Architect without a saved world. It is the main way
people will use Architect: today's real NBA, every tool, the same rules and
money as a world, with no sign-up. A new world starts from exactly the same
data and then keeps its own history. Real NBA updates never change a saved
world.

**The idea.** Today the accurate rule checks only run inside a saved world,
because they read a world's own records from the database. The plan gives
Sandbox a world of its own that lives in the visitor's browser instead of the
database. It is built from the current published NBA data, kept on the device
through reloads, and wiped by "Reset to today". The rules code stays the same.
Only the place it reads and saves changes. A browser world and a saved world
start from the same data and run the same code, so they agree by construction.

**What you will notice when it's done.**

- Sandbox opens on the current NBA data and shows its date ("NBA data as of
  Nov 14, 2026").
- Every tool works in Sandbox: trades, signings, waivers, stretch, buyouts,
  options, extensions, renouncing rights, sign-and-trade and offer sheets.
  History and Compare work for your session too.
- A move in Sandbox gives the same money and the same verdict as the same move
  in a brand-new world.
- Your Sandbox moves survive a reload until you press Reset to today.
- When newer NBA data is published, Sandbox offers to reset to it. It never
  silently mixes old and new data.

**Rough size.** About 6 to 8 weeks of agent work in 7 steps. Each step ships
on its own and saved worlds keep working throughout. This is larger than the
earlier 4 to 6 week outline because the detailed look found that the database
is touched in 37 files, not just a handful of loaders.

**Decisions you will be asked for** (details in [Owner decisions](#owner-decisions)):

1. OK to install the current NBA data on the live site (step 1).
2. Whether the sources' terms allow the data to be downloadable by anyone.
3. Stop refreshing the old shared records, so older worlds that still borrow
   them stay as they are (recommended yes).
4. Later: a "Save this Sandbox as a world" button (recommended after V1).

## What the survey found

These facts drive the design. File references are on `main` at `04f8dde`.

1. **The rules engine is already shared.** A Sandbox trade and a world trade
   both run `computeWorldMutation` (`GMDashboard/hooks/useArchitectActions.tradeActions.ts`).
   What differs is the input and where the result goes.
2. **Most tools are blocked in Sandbox today.** Waive, stretch, buyout,
   options, extensions and renouncing require a saved world
   (`useArchitectActions.contractActions.ts`). Sign-and-trade and offer sheets
   are world-only (`FREE_AGENCY_WORLD_ONLY_REQUIREMENTS`). Trades and plain
   signings run on older, looser paths: a July 15 placeholder date
   (`getDeterministicValidationDate`), non-governed salary matching, a separate
   browser pick overlay (`vacuumEntitlementOverlayStore.ts`), and only the
   viewed team updates after Apply.
3. **Every accurate check reads the same world records.** The governed loaders
   for trade salary, waivers, options and extensions (`loadWorldGoverned*`)
   read the world's contract baseline shards, world metadata (date, season,
   release pins) and its 30 teams. Draft custody (`governedDraftWorld.load.ts`)
   reads the world's draft root, entitlements, events and team snapshots.
4. **Records are stamped with the world ID.** Ledger IDs are
   `${worldId}:${contractId}:contract`. Around 25 rule files compare a record's
   `worldId` with the current one. Giving Sandbox its own scope ID keeps all of
   that code unchanged.
5. **The browser can already build those records.**
   `buildContractBaselineTeamDocuments(release, worldId)` in
   `utils/contractSource/contractSourceRelease.ts` builds a world's contract
   ledgers for any ID, mirroring the server initializer.
6. **Database use is concentrated and simple.** 37 Architect files import the
   Firestore SDK. They use `getDoc` and `getDocs`, three query operators
   (`==`, `in`, `array-contains`), one `orderBy` with `startAfter`,
   transactions, batches, `serverTimestamp`, `arrayUnion` and `deleteField`.
   A browser stand-in for this subset is realistic.
7. **Free agents are not in the starting data.** The financial package skips
   `FREE` (`scripts/architect/buildSimulationFinancialBaseline.ts`). Every
   world reads free agents from the live `architect_basePlayers` catalog, and
   offer-sheet commit re-reads shared base-player evidence
   (`mutationPipeline.persist.ts`). Both must come from the published version.
8. **No sign-up already works.** `useAuth` signs every visitor in anonymously.
   The draft-review endpoint's token check does not exclude anonymous accounts
   (to be confirmed by a test). The cost problem is that
   each visitor subscribes to the whole base player collection
   (`subscribeArchitectPlayerData.ts`).
9. **The data is small enough to download.** Each private package is capped at
   1 MB compressed. The June 5 contract release is already served publicly from
   `public/architect/contract-source-releases/` (11 MB raw, about 0.6 MB gzip).
10. **PR #688 (BZE-359) is the base to build on.** It stores the packages
    privately in Firestore and runs world creation from a Vercel endpoint, so
    it needs no Blaze plan. Its one limitation for this plan is that the
    current packages are pinned by digests in Vercel settings, which needs a
    settings change and a redeploy for every new snapshot.

## Design

### Three pieces

1. **Published NBA versions.** Each NBA snapshot is saved once as an immutable
   version: the financial package, the draft package, the free-agent pool and
   offer-sheet evidence, plus its date, season, assumptions and SHA-256.
   One small pointer record says which version is current. Publishing moves
   the pointer. Nothing is redeployed.
2. **One starting-state builder.** One shared function turns a version plus a
   scope ID into the complete set of starting world documents: metadata, 30
   teams, contract baseline shards, draft root, entitlements and the
   free-agent pool. The server's world initializer writes its output to
   Firestore. Sandbox loads the same output into the browser. Because both use
   one builder, an untouched world and a fresh Sandbox start identical.
3. **One document store, two backends.** Architect code stops calling the
   Firestore SDK directly. It calls a small store that offers read, query,
   transaction and batch over the same `architect_worlds/{id}/...` paths:
   - *Saved world:* backed by Firestore, with today's behavior.
   - *Sandbox:* the version's starting documents as a read-only base, plus a
     browser layer (IndexedDB) holding every document your moves wrote.
     Reloads keep it. Reset deletes the layer.

The mutation pipeline, governed loaders, draft custody, history and compare
all run unchanged on either backend. The scope ID for Sandbox is
`sandbox-<versionId>`, so every world-ID check in the rules code works as is.

### How the hard cases are answered

| Question | Answer |
| --- | --- |
| Contract records are stamped with a world ID | Sandbox gets scope ID `sandbox-<versionId>`; the builder stamps records with it. |
| Draft custody receipts belong to the world that committed them | Sandbox receipts are written to the browser layer under the Sandbox scope, so custody checks pass the same way. Reset clears them with the moves. |
| Concurrency checks compare document snapshots before commit | The Sandbox backend implements the same transaction read and compare, so stale-tab protection keeps working, including across two open tabs. |
| `serverTimestamp`, `arrayUnion`, `deleteField` | The Sandbox backend resolves them locally: device time for timestamps, plain array and field operations for the rest. |
| Offer sheets, where you control both teams | They work as in a world: you store an offer as one team and match or decline as the other. Evidence comes from the version, not the live base player. |
| Free agents | They are added to each version. Sandbox and new worlds read the pool from the version. Live `architect_basePlayers` is no longer read by Architect rules. |
| A new version is published while a Sandbox session exists | The session stays on its version. A banner offers "Newer NBA data (Dec 2) is available. Reset to it." Old and new data are never mixed. |
| Can a visitor tamper with their Sandbox? | Yes, in their own browser, but nothing is saved on the server, so it affects no one else. Saved worlds stay server-initialized. |
| No sign-up, and cost | The anonymous sign-in stays. Sandbox loads the current version from one cached Vercel response (immutable URL per version), then from the browser cache. It makes no per-visitor database reads. |
| Worlds created before this change, which still borrow shared records | They keep reading `architect_baseTeams` and `architect_basePlayers`. Once versions replace refreshes of those records (step 7), they stop changing, so those worlds stay stable without a migration. |
| Season advance | Post-V1, as today. Sandbox is one snapshot and has no season advance. |
| Simulation label and assumptions | Sandbox shows the same SIMULATION label and assumption notes as a world created from the version. |

### What is removed

When step 5 lands, these Sandbox-only paths are deleted: base-state trade
apply (`applyTradeExecutionHandoffToBaseState`), the vacuum pick overlay and
transfers, vacuum signing execution, the July 15 placeholder date, the
non-governed Trade Machine salary path, the per-dashboard base-team loading
for Sandbox, and the whole-collection player subscription. The net effect
should be less code.

## Steps

Sizes are rough agent-days and include tests and review fixes. Steps 1, 2 and
3 can overlap; 4 needs 2 and 3; 5 needs 1 and 4.

### Step 1. Published NBA versions (4 to 6 days)

Changes: extend PR #688's installer to write a version (both packages, the
free-agent pool, offer-sheet evidence and a manifest with digest, date, season
and assumptions) and to move a `current` pointer in the server-only package
collection. The world endpoint reads the pointer instead of digests in Vercel
settings, and verifies the digest stored in the manifest. Add a cached Vercel
endpoint that serves the current version's public view by immutable version
URL. Add free agents to the financial package builder (`FREE` records are in
the contract release already).

Done when: the live site has a current version, new worlds start from it, and
a test visitor can download it without signing up.

Review: second review (saving, security). Owner OK for the production install
and the Rules update.

### Step 2. One starting-state builder (3 to 4 days)

Changes: move the document-building parts of `initializeWorldService.ts`
(metadata, team staging, contract shards, draft root, retained entitlements)
into one shared module that both the server and the browser can import. The
server initializer calls it, with no behavior change. Add the free-agent pool
documents.

Done when: a world created by the server and a set of documents built in the
browser from the same version and scope ID are byte-identical apart from the
ID and server timestamps (a test).

Review: second review (saving).

### Step 3. Document store seam, Firestore backend only (8 to 10 days)

Changes: introduce the store interface and a Firestore backend. Convert the 37
Firestore-importing Architect files to it, in groups: team and player loaders,
governed loaders, entitlements and draft, mutation read and persist, history,
world manager. Each group is a pull request with no behavior change.

Done when: every saved-world test, including the emulator suites, passes
unchanged, and no Architect file outside the store imports `firebase/firestore`
(a guardrail test).

Review: second review for each group that touches saving.

### Step 4. Sandbox backend (5 to 7 days)

Changes: the browser backend described above. That covers reads over base plus
layer, the query subset, transactions with snapshot compare, batches, local
timestamps, IndexedDB persistence, reset, the version pin and the
newer-version banner. Run the store's own contract tests against both
backends.

Done when: the same store test suite passes on Firestore (emulator) and on the
Sandbox backend.

Review: second review (saving semantics).

### Step 5. Switch Sandbox over (5 to 7 days)

Changes: with no saved world selected, the dashboard opens the Sandbox scope on
the current version. Remove the world-only gates for actions that do not need
saving: waivers, options, extensions, renouncing, sign-and-trade and offer
sheets. Enable History and Compare for the session. Delete the paths listed in
[What is removed](#what-is-removed). Update the wording, so there is no "local
preview". Show the data date and Reset to today.

Done when: every W2 to W10 and W14 workflow runs in Sandbox from its normal
entry point, and reload keeps the moves.

Review: second review (legality, saving). Screenshots at 1280×720 and phone
width. The Reset button and banner are ordinary visible changes, not a
redesign.

### Step 6. Prove they match (3 to 4 days)

Changes: a parity harness that runs one scripted set of moves (trades with
picks, signings, waivers, options, sign-and-trade, an offer sheet) in Sandbox
and in an emulator world created from the same version. It compares books,
salary-matching amounts, exceptions, hard caps, draft custody and verdicts,
with IDs normalized, and fails on any difference. Add W16 cases to the E1
battery.

Done when: the harness passes and runs in CI for any change to rules, the
store or the builder.

### Step 7. One data track (5 to 7 days, needed before the first post-Nov 14 update)

Changes: the maintenance run produces a new version instead of writing
`architect_baseTeams` and `architect_basePlayers`. It reuses the existing
financial preparation and draft compile steps, which become the standard path.
Those two collections become frozen legacy for pre-change worlds.
`players_v2` and the scouting pages are unchanged.

Done when: one documented command sequence turns a refresh into a reviewed
version, and publishing it updates Sandbox and new worlds with no deploy.

Note: the judgment steps (draft-rule interpretation, conflicting sources) stay
reviewed. Automating more of them is the owner's separate concern, kept out of
this plan.

## Tests and reviews

- Behavior-preserving steps (2, 3) rely on the existing suites, including the
  emulator tests, plus guardrails that no Architect code bypasses the store or
  the builder.
- New behavior (1, 4, 5) gets focused tests and a second review under
  AGENTS.md (saving, legality, security).
- Step 6's parity harness is the lasting guarantee that Sandbox and worlds
  agree after future rule changes.

## Risks

| Risk | Mitigation |
| --- | --- |
| The store refactor breaks saving | One no-behavior-change group per pull request; emulator suites; second review. |
| The Sandbox backend's transaction or timestamp behavior drifts from Firestore | One shared store contract suite runs against both backends. |
| Bandwidth cost grows with traffic | Immutable, cached version files of about 1 to 3 MB, cached in the browser after the first visit. Watch Vercel usage. |
| The data sources' terms for public download | Owner decision 2 before launch. The public view contains only what the product shows. |
| Coordination with PR #688 | Step 1 changes its package selection. Agree in the cross-review before #688 merges. |
| Browser storage cleared or unavailable (private mode) | Sandbox still works and starts fresh, with a note that moves are not kept. |
| Older pre-change worlds | No migration. They stay readable and stable once the shared records stop changing. |

## Owner decisions

1. **Install the current version on the live site** (step 1): needs your OK,
   as with D2 today.
2. **Public download of the NBA data.** Sandbox without sign-up means anyone
   can load the full snapshot. The June 5 contract data is already public in
   the site's files. Please confirm the sources' terms allow this before
   launch.
3. **Freeze the old shared records** (step 7, recommended yes). Older worlds
   that borrow them then stay exactly as they are.
4. **"Save this Sandbox as a world"** (recommended after V1). It needs the
   server to re-check every move before saving, which is real work.

## Relation to the V1 checklist

S1 is steps 1 and 7. S2 and S3 are steps 2 to 6 (date, salary path,
draft source, exceptions). S4 is step 5. Contract decision 7 and W16 are
verified by step 6 and the E1 additions.
