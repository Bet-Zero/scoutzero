# Lakers Staging Visuals

Visual checkpoints for the Lakers sample used while wiring the baseTeams staging pipeline.

## SalarySwish Team Data (Parser Output)

- 14-player roster with source URLs for downstream ID mapping
- 28 cap holds spanning RFAs, UFAs, and legacy FA cap holds
- Complete exception set (MLE, BAE, three TPEs) with usage tracking
- Totals include cap space, tax space, and apron rooms

```json
{
  "teamCode": "LAL",
  "teamName": "LOS ANGELES LAKERS",
  "season": "2025-26",
  "roster": [
    { "displayName": "James, LeBron", "sourceUrl": "https://www.salaryswish.com/players/lebron-james" },
    { "displayName": "Doncic, Luka", "sourceUrl": "https://www.salaryswish.com/players/luka-doncic" },
    { "displayName": "Hachimura, Rui", "sourceUrl": "https://www.salaryswish.com/players/rui-hachimura" },
    "// ... roster trimmed ...": ""
  ],
  "capHolds": [
    { "displayName": "Watson, Anton", "capHoldAmount": 2457010, "type": "RFA" },
    { "displayName": "James, LeBron", "capHoldAmount": 57915200, "type": "UFA" },
    { "displayName": "Ellington, Wayne", "capHoldAmount": 2296274, "type": "FA Cap Hold" }
  ],
  "exceptions": {
    "mle": { "type": "Non-Taxpayer", "total": 14104000, "used": 14104000, "remaining": 0, "available": false },
    "bae": { "total": 5135000, "used": 5134000, "remaining": 1000, "available": true },
    "tpe": [
      { "id": "TPE-LAL-Dec 29, 2025-1", "totalAmount": 1891857, "remainingAmount": 1891857, "expiresOn": "Dec 29, 2025" },
      "// ... more trade exceptions ...": ""
    ]
  },
  "totals": {
    "totalSalary": 210894723,
    "capSpace": -40173805,
    "luxuryTaxLine": 187895000,
    "firstApronRoom": 1124195,
    "secondApronRoom": 13003195
  }
}
```

## Draft Picks Source Payload

The staging script prefers RealGM structured output. When that file is absent, it falls back to the lighter SalarySwish draft grid captured below.

```json
[
  { "year": 2026, "round": 1, "status": "own" },
  { "year": 2027, "round": 1, "status": "contested", "contendingTeams": ["UTA", "LAL"] },
  { "year": 2029, "round": 1, "status": "outgoing", "tradedOn": "Feb 2, 2025" },
  { "year": 2026, "round": 2, "status": "outgoing", "tradedOn": "Nov 23, 2020" },
  { "year": 2032, "round": 2, "status": "own" }
]
```

## Firestore Preview (`/architect/baseTeams/LAL`)

- Roster collapsed to canonical `playerId`s (14 resolved, 11 temporary IDs for historical cap holds)
- Exceptions normalized to canonical schema (MLE, taxpayer MLE, room, BAE, DPE, TPE)
- Draft pick entries normalized to single array with owner/original team metadata
- Source block tags both SalarySwish and RealGM provenance + staging timestamp

```json
{
  "teamCode": "LAL",
  "teamName": "LOS ANGELES LAKERS",
  "season": "2025-26",
  "roster": ["lebron_james", "luka_doncic", "rui_hachimura", "// ... trimmed ..."],
  "capHolds": [
    { "playerId": "tmp_anton_watson_e246c1", "playerName": "Anton Watson", "amount": 2457010, "type": "RFA" },
    { "playerId": "lebron_james", "playerName": "LeBron James", "amount": 57915200, "type": "UFA" },
    { "playerId": "tmp_wayne_ellington_b2b231", "playerName": "Wayne Ellington", "amount": 2296274, "type": "FA Cap Hold" }
  ],
  "exceptions": {
    "mle": { "type": "Non-Taxpayer", "available": false, "totalAmount": 14104000, "usedAmount": 14104000 },
    "bae": { "available": true, "totalAmount": 5135000, "usedAmount": 5134000, "remainingAmount": 1000 },
    "tpe": [
      { "id": "TPE-LAL-Dec 29, 2025-1", "totalAmount": 1891857, "remainingAmount": 1891857, "expiresOn": "Dec 29, 2025" }
    ]
  },
  "draftPicks": [
    { "id": "LAL_2026_1_own", "year": 2026, "round": 1, "owner": "LAL", "status": "own" },
    { "id": "LAL_2027_1_contested", "year": 2027, "round": 1, "owner": "LAL", "status": "contested", "notes": "Contending teams: UTA, LAL" },
    { "id": "LAL_2029_1_outgoing", "year": 2029, "round": 1, "owner": "LAL", "status": "outgoing", "notes": "Traded on Feb 2, 2025" }
  ],
  "totals": {
    "totalSalary": 210894723,
    "rosterCount": 21,
    "capSpace": -40173805,
    "firstApron": 195945000,
    "firstApronRoom": 1124195,
    "secondApron": 207824000,
    "secondApronRoom": 13003195
  },
  "source": {
    "provider": "SalarySwish",
    "teamPageUrl": "https://www.salaryswish.com/teams/lakers",
    "season": "2025-26",
    "type": "SalarySwish",
    "baseTeamVersion": "1.0",
    "generatedAt": "2025-10-17T08:30:33.446Z"
  },
  "lastUpdated": "2025-10-17T08:30:33.446Z",
  "version": "1.0"
}
```

> **Note:** Cap-hold player IDs fall back to deterministic placeholders when the shared player index does not include legacy free agents. Re-running the pipeline after extending the index will automatically replace the `tmp_*` IDs.

