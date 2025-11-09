## Firestore Staging Mapping

This guide captures how scraped player data maps into the two Firestore targets we care about: `players_v2` and `/architect/basePlayers`. It is the reference for the staging scripts so we can diff staged JSON against expectations before any writes occur.

### Source Inputs

- **Contract scrape** (`player-scrape/contracts/output/<TEAM>/<playerId>.json`)
  - Top-level `teamCode`, `teamName`, `bio`, `contract`, optional `futureContract`, `representation`, `source`, `lastUpdated`.
- **Stats scrape** (`player-scrape/stats/output/<TEAM>/<playerId>.json`)
  - Top-level `teamCode`, `seasons`, `meta` (season tag, timestamps).
- **Player index** (`player-scrape/shared/outputs/player_index.json`)
  - `fullName`, `nbaId`, `salarySwishSlug`, `teamCode` (roster assignment).

### players_v2 Mapping

| Firestore path | Target field(s) | Source / transformation |
| --- | --- | --- |
| `players_v2/{playerId}` | `bio.displayName` | contract `displayName` (fallback index `fullName`) |
|  | `bio.name` | index `fullName` |
|  | `bio.playerId` | `playerId` key |
|  | `bio.position` | contract `bio.position` |
|  | `bio.height` | contract `bio.height` → inches (e.g. `6-7` → `79`) |
|  | `bio.weight` | contract `bio.weight` → lbs number |
|  | `bio.dob` | contract `bio.birthdate` (ISO conversion) |
|  | `bio.shoots` | contract `bio.shoots` |
|  | `bio.agent` | contract `representation` (agent/agency) |
|  | `bio.draft` | contract `bio` draft fields (`draftYear`, `draftRound`, `draftPick`, `draftedBy`) |
|  | `bio.display.team` | roster team from index (`teamCode` → lookup name) |
|  | `bio.display.teamId` | index `teamCode` |
|  | `bio.display.POS` | contract `bio.position` |
|  | `bio.display.averageAnnualValue` | weighted average across live seasons (current + future) |
|  | `bio.display.yearsLeft` | count of post-today seasons across all contracts |
|  | `bio.display.freeAgentYear` | final season end + 1 (considers extensions) |
|  | `bio.display.freeAgentType` | highest-priority FA type from latest contract |
|  | `createdAt` / `updatedAt` | staging timestamp (ISO) |

Contracts subcollection (`players_v2/{playerId}/contracts/{contract_N}`):

| Field | Source / notes |
| --- | --- |
| `contractType` … `tradeRestrictions` | Direct copy from basePlayers |
| `metadata.isCurrent` | `true` for active contract, `false` otherwise |
| `metadata.label` | contract type (e.g., `"VETERAN EXTENSION"`) |
| `metadata.startSeason` / `metadata.endSeason` | convenience mirrors |

Document IDs are ordinal: `contract_1`, `contract_2`, … ordered chronologically by start season. `contract_1` is earliest historical deal, `contract_N` is the latest. No renames needed when new contracts arrive.

Seasons subcollection (`players_v2/{playerId}/seasons/{seasonId}`):

| Field | Source |
| --- | --- |
| `team` | stats `seasons[season].team` |
| `age` | stats `seasons[season].age` |
| `stats` | per-game stats block |
| `meta` | stats `meta` merged with contract reference (if needed) |

Evaluations subcollection will be seeded later (out of scope for initial staging).

### /architect/basePlayers Mapping

| Field | Source / transformation |
| --- | --- |
| `playerId` | scrape `playerId` |
| `displayName` | contract `displayName` |
| `teamCode` / `teamName` | contract top-level values |
| `bio` | direct copy of contract `bio` fields (no numeric conversion required) |
| `contract` | direct copy of normalized contract object |
| `futureContract` | present if contract output contains it |
| `representation` | contract `representation` |
| `lastUpdated` | contract `lastUpdated` |
| `version` | contract `version` |

Because basePlayers schema expects `tradeRestrictions`, guarantee schedule, etc., we rely on the normalized contract JSON verbatim; staging should only enforce required defaults when the scraper omits optional arrays.
> BasePlayers documents intentionally omit the scraped `source` block so Architect data stays internal-only.

### Views Subcollection

`players_v2/{playerId}/views/contracts` — condensed timeline used for cap-table style displays.

| Field | Description |
| --- | --- |
| `seasons[]` | Array of per-season entries ordered chronologically. Each entry contains:<br>• `season`: `"YYYY-YY"`<br>• `salary`: numeric cap hit (includes future extensions)<br>• `guaranteed`: boolean (true if fully guaranteed at season start)<br>• `guaranteedAmount`: guaranteed dollars for that season<br>• `optionType`: `"PO"`, `"TO"`, `"ETO"`, or `null`<br>• `optionDecisionDate`: ISO date string if applicable<br>• `voidedByExtension`: true if the year was voided<br>• `sourceContractId`: reference to `contracts/contract_N` |
| `freeAgentYear` | First season after the last guaranteed season. |
| `freeAgentType` | Player’s free-agent type for that offseason (`UFA`, `RFA`, etc.). |

Additional view docs can mirror this pattern (`views/seasons`, `views/evaluations`).

### Outstanding Normalization Tasks

- Extend staging to derive `bio.display` aggregates for complex scenarios (e.g., partially guaranteed options, overlapping extensions).
- Consider deriving season `age` when stats payload omits it.

## Dry-Run Firestore Preview

Use the dry-run CLI to inspect what would be written to Firestore (no writes executed):

```bash
npx tsx player-scrape/firestore_staging/dry_run_write.ts --players=toumani_camara,luka_doncic
```

Flags:

- `--players=` comma-separated list (defaults to all staged players).
- `--stageDir=` optional path if using a non-default staging output directory.

The command prints each Firestore path (e.g., `players_v2/{playerId}/contracts/{contractId}` and `architect/basePlayers/{playerId}`) followed by the JSON payload.

Sample documentation and per-layer JSON snapshots live in:

- `player-scrape/firestore_staging/docs/players_v2_structure.md`
- `player-scrape/firestore_staging/docs/basePlayers_structure.md`
- `player-scrape/firestore_staging/output/players_v2/` (generated, git-ignored)
- `player-scrape/firestore_staging/output/basePlayers/` (generated, git-ignored)

