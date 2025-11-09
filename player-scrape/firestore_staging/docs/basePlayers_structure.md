# /architect/basePlayers Layout (Toumani Camara Example)

Dry-run outputs produced by the staging pipeline mirror the data we will eventually store in `/architect/basePlayers/{playerId}`. This document breaks the structure down using `toumani_camara` as an example.

## Root Document `/architect/basePlayers/toumani_camara`

The base player doc is a single JSON document—no subcollections. It combines the player's bio, current contract, future contract (if any), representation, and source metadata.

```json
{
  "playerId": "toumani_camara",
  "displayName": "Toumani Camara",
  "teamCode": "POR",
  "teamName": "Portland Trail Blazers",
  "bio": {
    "position": "F",
    "height": "6-7",
    "weight": "230",
    "age": 25,
    "birthdate": "May 8, 2000",
    "experience": 2,
    "shoots": "Left",
    "draftYear": "2023",
    "draftRound": 2,
    "draftPick": 52,
    "draftedBy": "PHX"
  },
  "contract": { ... },
  "futureContract": { ... },
  "representation": {
    "agent": "David Putterie",
    "agency": "Up Tempo Sports Management"
  },
  "source": {
    "provider": "SalarySwish",
    "playerPageUrl": "https://salaryswish.com/players/toumani-camara",
    "scrapedAt": "2025-11-06T12:35:43.151Z"
  },
  "lastUpdated": "2025-11-06T12:35:43.152Z",
  "version": "1.0"
}
```

### Contract Block

Identical to the normalized contract JSON emitted by the scraper.

```json
"contract": {
  "contractType": "ROOKIE CONTRACT",
  "isExtension": false,
  "signedUsing": "Second Round Rookie Exception",
  "signingTeam": "PHX",
  "startSeason": "2023-24",
  "endSeason": "2026-27",
  "contractLength": 4,
  "yearsRemaining": 2,
  "totalValue": 7639302,
  "salariesByYear": [
    { "season": "2025-26", "salary": 2221677, "guaranteed": true },
    { "season": "2026-27", "salary": 2406205, "guaranteed": false, "option": "TO" }
  ],
  "freeAgency": { "type": "UFA", "year": 2027, "optionType": "TO" },
  "tradeEligibility": { "rules": { "aggregation": true, "poisonPill": false, "baseYearCompensation": false } },
  "birdRights": { "status": "Bird", "eligibleFor": ["Bird Exception"] }
}
```

### Future Contract

Provided when the scraper captured a future/extension table.

```json
"futureContract": {
  "contractType": "VETERAN EXTENSION",
  "isExtension": true,
  "signingTeam": "POR",
  "startSeason": "2026-27",
  "endSeason": "2029-30",
  "contractLength": 4,
  "totalValue": 81000000,
  "salariesByYear": [
    { "season": "2026-27", "salary": 18080358 },
    { "season": "2027-28", "salary": 19526786 },
    { "season": "2028-29", "salary": 20973214 },
    { "season": "2029-30", "salary": 22419642 }
  ],
  "freeAgency": { "type": "UFA", "year": 2030 }
}
```

## Luka Doncic Snapshot

For comparison, `luka_doncic` includes the Lakers extension as the future contract while the current contract is still the Dallas rookie extension. You can inspect the full payload in `player-scrape/firestore_staging/output/basePlayers/luka_doncic.json` after running the staging script (outputs are git-ignored).

## Quick Reference

- No subcollections; everything for a player lives in a single document.
- Fields align 1:1 with `BasePlayerDocZ` defined in `src/schemas/architect.ts`.
- Staged JSON lives under `player-scrape/firestore_staging/output/basePlayers/` (git-ignored by default).

