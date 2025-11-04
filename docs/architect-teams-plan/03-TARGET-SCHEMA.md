# Target Data Schema - Complete Examples

## Overview

This document provides exact, field-by-field examples of the target Firestore data structure for the Architect Teams Plan.

**Canonical schema**: `src/schemas/architect.ts` (Zod definitions)  
**Generated docs**: `docs/schema/architect.md` (auto-generated from Zod schemas)  
**This document**: Detailed examples and implementation guidance for the Architect Teams Plan

---

## 1. Base Team Document

**Path:** `/architect/baseTeams/LAL`

    {
      // ===== TEAM IDENTITY =====
      "teamCode": "LAL",
      "teamName": "Los Angeles Lakers",
      "season": "2025-26",
      "abbreviation": "LAL",
      "city": "Los Angeles",
      "conference": "Western",
      "division": "Pacific",

      // ===== ROSTER (Player IDs only) =====
      "roster": [
        "lebron_james",
        "anthony_davis",
        "austin_reaves"
        // ... ~15 total players
      ],

      // ===== DEAD CAP (Waived players) =====
      "deadCap": [
        {
          "playerId": "waived_veteran_name",
          "playerName": "Waived Veteran",
          "originalSalary": 10000000,
          "amountByYear": [
            {
              "season": "2025-26",
              "amount": 1500000,
              "isStretched": true
            },
            {
              "season": "2026-27",
              "amount": 1500000,
              "isStretched": true
            }
          ],
          "waiveDate": "2025-10-01",
          "notes": "Stretched over 3 years"
        }
      ],

      // ===== CAP HOLDS (Unsigned free agents with rights) =====
      "capHolds": [
        {
          "playerId": "rfa_guard_name",
          "playerName": "RFA Guard",
          "amount": 9000000,
          "type": "Non-Bird",  // "Bird" | "Early Bird" | "Non-Bird"
          "isSigned": false,
          "expiresOn": "2026-06-30"
        }
      ],

      // ===== EXCEPTIONS =====
      "exceptions": {
        // Mid-Level Exception
        "mle": {
          "type": "Non-Taxpayer",  // "Non-Taxpayer" | "Taxpayer" | "Room"
          "available": true,
          "totalAmount": 12900000,
          "usedAmount": 3000000,
          "remainingAmount": 9900000,
          "expiresOn": "2026-06-30",
          "usedFor": [
            {
              "playerId": "mid_level_signing",
              "playerName": "MLE Player",
              "amount": 3000000
            }
          ]
        },

        // Bi-Annual Exception
        "bae": {
          "available": false,
          "reason": "Used in previous season",
          "availableAgainOn": "2026-07-01"
        },

        // Trade Exceptions
        "tradeExceptions": [
          {
            "id": "tpe_xyz_20251015",
            "amount": 7200000,
            "remainingAmount": 7200000,
            "createdFrom": "Trade of Player X",
            "createdOn": "2025-10-15",
            "expiresOn": "2026-10-15",
            "usedFor": []
          },
          {
            "id": "tpe_abc_20240301",
            "amount": 5000000,
            "remainingAmount": 2000000,
            "createdFrom": "Trade of Player Y",
            "createdOn": "2024-03-01",
            "expiresOn": "2025-03-01",
            "usedFor": [
              {
                "playerId": "acquired_player",
                "playerName": "Acquired Player",
                "amount": 3000000,
                "usedOn": "2025-02-15"
              }
            ]
          }
        ]
      },

      // ===== DRAFT CAPITAL =====
      "draftPicks": [
        {
          "id": "NYK_2028_1st_to_BRK",
          "year": 2028,
          "round": 1,
          "status": "contested",
          "originalTeam": "NYK",
          "currentOwner": "BRK",
          "stepienEligible": false,
          "tradeable": false,
          "isSwap": true,
          "swapDetails": {
            "swapType": "favorable",
            "favorable": "most"
          },
          "protection": null,
          "conditions": [
            { "range": "31-50", "outcome": "keep", "recipient": "MEM" },
            { "range": "51-60", "outcome": "convey", "recipient": "MIN" }
          ],
          "dependsOn": [ "PHL_2026_1st_conditional" ],
          "conveyanceObligation": {
            "id": "WAS_2027_2nd_conditional",
            "description": "WAS 2027 2nd conditional conveyance",
            "originalYear": 2027,
            "currentYear": 2027,
            "stepienImpact": {
              "eligibleForStepien": false,
              "locksYears": [],
              "deadYears": [],
              "affectedYears": [ 2027 ]
            },
            "conditions": {
              "ifConveys": "WAS does not convey 1st to NYK in 2026 (via HOU→OKC)",
              "ifRolls": "resolves in current year",
              "protection": "conditional"
            },
            "affects": [ "NYK" ]
          },
          "recipient": "BRK",
          "via": "IND",
          "route": ["IND"],
          "pickNumber": null,
          "detailUrl": "https://…",
          "metadata": {
            "sourcePage": "NYK",
            "tradePath": ["IND"],
            "scrapedFrom": "https://…",
            "hasComplexRouting": true,
            "isFromOriginalTeam": false,
            "pickJourney": {
              "startedWith": "NYK",
              "routedThrough": [],
              "currentlyWith": "BRK",
              "finalDestination": "BRK"
            }
          }
        }
      ],

      // ===== CAP SUMMARY (Calculated) =====
      // All `totals` fields are derived at load-time. They may be cached but must be recalculated after every action.
      "totals": {
        // Salary totals
        "totalSalary": 180200000,
        "guaranteedSalary": 175000000,
        "nonGuaranteedSalary": 5200000,

        // Roster counts
        "rosterCount": 15,
        "guaranteedContracts": 13,
        "nonGuaranteedContracts": 2,
        "twoWayContracts": 2,
        "emptyRosterCharges": 0,

        // Cap space calculations
        "capSpace": -4250000,  // Negative = over cap
        "capRoom": 0,
        "effectiveCap": 140588000,  // 2025-26 salary cap

        // Luxury tax
        "luxuryTaxLine": 170814000,
        "taxablePayroll": 180200000,
        "isOverTax": true,
        "taxBill": 15000000,  // Estimated
        "taxRate": 1.75,  // Repeater rate

        // Aprons
        "firstApron": 178132000,
        "firstApronRoom": 2068000,
        "isFirstApron": false,

        "secondApron": 188931000,
        "secondApronRoom": 8731000,
        "isSecondApron": false,

        // Hard cap (if applicable)
        "isHardCapped": false,
        "hardCapLevel": null,  // "First Apron" | "Second Apron" | null
        "hardCapRoom": null
      },

      // ===== METADATA =====
      "source": {
        "provider": "SalarySwish",
        "teamPageUrl": "https://salaryswish.com/teams/lakers",
        "scrapedAt": "2025-10-14T05:00:00Z",
        "season": "2025-26"
      },
      "lastUpdated": "2025-10-14T05:00:00Z",
      "version": "1.0"
    }

**Size Estimate:** ~50KB per team × 30 teams = **1.5MB total for all base teams**

---

## 2. Base Player Document

**Path:** `/architect/basePlayers/austin_reaves`

    {
      // ===== PLAYER IDENTITY =====
      "playerId": "austin_reaves",
      "displayName": "Austin Reaves",
      "teamCode": "LAL",
      "teamName": "Los Angeles Lakers",

      // ===== BIO (Minimal - from team page) =====
      "bio": {
        "position": "G",
        "height": "6-5",
        "weight": "206",
        "age": 26,
        "birthdate": "1998-05-29",
        "experience": 3,  // Years in NBA
        "shoots": "Right",
        "draftYear": "2021",
        "draftRound": 2,
        "draftPick": 39,
        "draftedBy": "LAL"
      },

      // ===== CONTRACT SUMMARY =====
      "contract": {
        // Contract type
        "contractType": "VETERAN CONTRACT",  // "ROOKIE SCALE" | "VETERAN CONTRACT" | "TWO-WAY"
        "isExtension": false,
        "isRookieScale": false,

        // Signing details
        "signedUsing": "Bird Exception",  // "Bird" | "Early Bird" | "Non-Bird" | "MLE" | "Room" | "Minimum" | "TPE"
        "signingTeam": "LAL",
        "signingDate": "2023-06-29",
        "signingExecutive": "Rob Pelinka",
        "signedByCurrentTeam": true,

        // Contract duration
        "startSeason": "2023-24",
        "endSeason": "2027-28",
        "contractLength": 4,
        "yearsRemaining": 3,

        // Financial summary
        "totalValue": 53830000,
        "averageAnnualValue": 13457500,
        "guaranteedValue": 53830000,
        "guaranteedYears": 4,

        // ===== PER-SEASON BREAKDOWN =====
        "salariesByYear": [
          {
            "season": "2025-26",
            "salary": 12000000,
            "capHit": 12000000,  // Can differ if incentives
            "guaranteed": true,
            "guaranteedAmount": 12000000,
            "option": null,  // null | "PO" (Player Option) | "TO" (Team Option) | "ETO" (Early Termination)
            "optionUsed": null,
            "optionDecisionDate": null,
            "tradeBonus": null,  // null or dollar amount
            "incentives": {
              "likely": 0,
              "unlikely": 0
            },
            "guaranteeSchedule": null,
            "voidedByExtension": false,
            "voidedOn": null
          },
          {
            "season": "2026-27",
            "salary": 13900000,
            "capHit": 13900000,
            "guaranteed": true,
            "guaranteedAmount": 13900000,
            "option": null,
            "optionUsed": null,
            "optionDecisionDate": null,
            "tradeBonus": null,
            "incentives": {
              "likely": 0,
              "unlikely": 0
            },
            "guaranteeSchedule": null,
            "voidedByExtension": false,
            "voidedOn": null
          },
          {
            "season": "2027-28",
            "salary": 15000000,
            "capHit": 15000000,
            "guaranteed": false,
            "guaranteedAmount": 0,
            "option": "PO",  // Player option
            "optionUsed": null,  // null | true | false (decided upon)
            "optionDecisionDate": null,  // Date when option decision made
            "tradeBonus": null,
            "incentives": {
              "likely": 0,
              "unlikely": 0
            },
            "guaranteeSchedule": null,  // Optional array of guarantee milestones
            "voidedByExtension": false,  // If year voided by extension
            "voidedOn": null  // Date when voided, if applicable
          }
        ],

        // ===== TRADE CLAUSES =====
        "noTradeClause": false,
        "tradeKicker": null,  // null or percentage (e.g., 15 for 15%)
        "tradeRestrictions": [],  // e.g., ["Cannot be traded before 2026-03-01"]

        // ===== BIRD RIGHTS & FREE AGENCY =====
        "birdRights": {
          "status": "Bird",  // "None" | "Non-Bird" | "Early Bird" | "Bird"
          "yearsOfService": 3,  // Years with current team
          "yearsWithTeam": 3,
          "eligibleFor": ["Bird Exception", "Early Bird Exception"]
        },

        "freeAgency": {
          "type": "UFA",  // "RFA" | "UFA" | null
          "year": 2028,  // When they become FA (if option declined)
          "capHold": 18750000,  // Cap hold amount if unsigned
          "qualifyingOffer": null,  // For RFAs only
          "earlyTerminationOption": null,  // If player has ETO
          "hasOption": true,  // If current contract has option
          "optionYear": "2027-28",  // Which year has the option
          "optionType": "PO"  // "PO" | "TO" | "ETO"
        },

        // ===== TRADE ELIGIBILITY =====
        "tradeEligibility": {
          "canBeTradedNow": null,  // Always null in base schema (validation happens at runtime)
          "restrictedUntil": null,  // Date string if recently signed/traded
          "reason": null,  // "Recent signing" | "Recent trade" | "Two-way conversion" | null
          "rules": {
            "baseYearCompensation": false,  // BYC applies?
            "poisonPill": false,  // Poison pill applies?
            "aggregation": true  // Can be aggregated with other salaries?
          }
        },

        // ===== CONTRACT METADATA =====
        "isMaxContract": false,  // If player on max contract
        "maxType": null,  // null | "25%" | "30%" | "35%" (max tier)
        "estimatedCapPercentage": 8.5,  // Estimated % of cap
        "supersededIn": null,  // Season when superseded by extension
        "supersededByContractRef": null,  // Reference to replacement contract
        "supersedesContractRef": null  // Reference to contract this supersedes
      },

      // ===== FUTURE CONTRACT (Optional) =====
      "futureContract": null,  // Contract that starts after current one (e.g., supermax extension)

      // ===== REPRESENTATION (Optional) =====
      "representation": {
        "agent": "Austin Brown",
        "agency": "CAA"
      },

      // ===== METADATA =====
      "source": {
        "provider": "SalarySwish",
        "playerPageUrl": "https://salaryswish.com/players/austin-reaves",
        "scrapedAt": "2025-10-14T05:00:00Z"
      },
      "lastUpdated": "2025-10-14T05:00:00Z",
      "version": "1.0"
    }

**Size Estimate:** ~5KB per player × 530 players = **2.65MB total for all base players**

---

## 3. Example Player with Rookie Scale Contract

**Path:** `/architect/basePlayers/anthony_edwards`

    {
      "playerId": "anthony_edwards",
      "displayName": "Anthony Edwards",
      "teamCode": "MIN",
      "teamName": "Minnesota Timberwolves",

      "bio": {
        "position": "SG",
        "height": "6-4",
        "weight": "225",
        "age": 23,
        "birthdate": "2001-08-05",
        "experience": 4,
        "shoots": "Right",
        "draftYear": "2020",
        "draftRound": 1,
        "draftPick": 1,
        "draftedBy": "MIN"
      },

      "contract": {
        "contractType": "DESIGNATED ROOKIE EXTENSION",
        "isExtension": true,
        "isRookieScale": true,  // ← Important for poison pill logic

        "signedUsing": "Bird Exception",
        "signingTeam": "MIN",
        "signingDate": "2024-07-06",
        "signingExecutive": "Tim Connelly",
        "signedByCurrentTeam": true,

        "startSeason": "2024-25",
        "endSeason": "2028-29",
        "contractLength": 5,
        "yearsRemaining": 4,

        "totalValue": 244500000,  // Max extension
        "averageAnnualValue": 48900000,
        "guaranteedValue": 244500000,
        "guaranteedYears": 5,

        "salariesByYear": [
          {
            "season": "2025-26",
            "salary": 42295455,
            "capHit": 42295455,
            "guaranteed": true,
            "guaranteedAmount": 42295455,
            "option": null,
            "optionUsed": null,
            "optionDecisionDate": null,
            "tradeBonus": null,
            "incentives": { "likely": 0, "unlikely": 500000 },  // All-NBA bonus
            "guaranteeSchedule": null,
            "voidedByExtension": false,
            "voidedOn": null
          },
          {
            "season": "2026-27",
            "salary": 45679242,
            "capHit": 45679242,
            "guaranteed": true,
            "guaranteedAmount": 45679242,
            "option": null,
            "optionUsed": null,
            "optionDecisionDate": null,
            "tradeBonus": null,
            "incentives": { "likely": 0, "unlikely": 500000 },
            "guaranteeSchedule": null,
            "voidedByExtension": false,
            "voidedOn": null
          },
          {
            "season": "2027-28",
            "salary": 49063028,
            "capHit": 49063028,
            "guaranteed": true,
            "guaranteedAmount": 49063028,
            "option": null,
            "optionUsed": null,
            "optionDecisionDate": null,
            "tradeBonus": null,
            "incentives": { "likely": 0, "unlikely": 500000 },
            "guaranteeSchedule": null,
            "voidedByExtension": false,
            "voidedOn": null
          },
          {
            "season": "2028-29",
            "salary": 52446815,
            "capHit": 52446815,
            "guaranteed": true,
            "guaranteedAmount": 52446815,
            "option": null,
            "optionUsed": null,
            "optionDecisionDate": null,
            "tradeBonus": 15,  // 15% trade kicker in final year
            "incentives": { "likely": 0, "unlikely": 500000 },
            "guaranteeSchedule": null,
            "voidedByExtension": false,
            "voidedOn": null
          }
        ],

        "noTradeClause": false,
        "tradeKicker": 15,  // 15% kicker
        "tradeRestrictions": [],

        "birdRights": {
          "status": "Bird",
          "yearsOfService": 4,
          "yearsWithTeam": 4,
          "eligibleFor": ["Bird Exception"]
        },

        "freeAgency": {
          "type": null,  // Still under contract
          "year": 2029,
          "capHold": null,
          "qualifyingOffer": null,
          "earlyTerminationOption": null,
          "hasOption": false,
          "optionYear": null,
          "optionType": null
        },

        "tradeEligibility": {
          "canBeTradedNow": null,
          "restrictedUntil": "2025-01-06",  // 6 months after extension signed
          "reason": "Recent extension",
          "rules": {
            "baseYearCompensation": false,
            "poisonPill": true,  // ← Poison pill applies (rookie extension)
            "aggregation": true
          }
        },

        // ===== CONTRACT METADATA =====
        "isMaxContract": true,
        "maxType": "25%",
        "estimatedCapPercentage": 30.0,
        "supersededIn": null,
        "supersededByContractRef": null,
        "supersedesContractRef": null
      },

      "futureContract": null,
      "representation": {
        "agent": "Omar Wilkes",
        "agency": "Klutch Sports"
      },

      "source": {
        "provider": "SalarySwish",
        "playerPageUrl": "https://salaryswish.com/players/anthony-edwards",
        "scrapedAt": "2025-10-14T05:00:00Z"
      },
      "lastUpdated": "2025-10-14T05:00:00Z",
      "version": "1.0"
    }

---

## 4. World Metadata Document

**Path:** `/architect/worlds/world_abc123/metadata`

    {
      "worldId": "world_abc123",
      "worldName": "Lakers 2026 Trade Scenarios",
      "description": "Exploring trade options for the 2026 deadline",

      // Ownership
      "createdBy": "user_uid_xyz",
      "createdAt": "2025-10-14T08:00:00Z",
      "lastModifiedAt": "2025-10-14T09:30:00Z",

      // Current state
      "currentSeason": "2025-26",
      "baselineSeason": "2025-26",  // What season this world branched from

      // Branching
      "parentWorldId": null,  // null if root world, otherwise parent world ID
      "branchedFrom": null,  // timestamp when branched
      "childWorlds": [],  // Array of world IDs that branched from this one

      // Modifications tracking
      "modifiedTeams": ["LAL", "NOP"],  // Teams that have snapshots
      "actionCount": 3,  // Number of actions taken
      "lastAction": {
        "type": "trade",
        "timestamp": "2025-10-14T09:30:00Z",
        "description": "Traded Austin Reaves to NOP for Jordan Poole"
      },

      // Tags/categories
      "tags": ["trade-deadline", "lakers", "2026"],
      "isArchived": false,
      "isFavorite": true,

      // Quick stats
      "stats": {
        "totalTrades": 2,
        "totalSignings": 1,
        "totalWaives": 0,
        "teamsInvolved": 2
      }
    }

---

## 5. World Team Snapshot

**Path:** `/architect/worlds/world_abc123/snapshot/teams/LAL`

**Content:** Same structure as base team document, but represents the modified state.

    {
      // SAME FIELDS as baseTeams/LAL, but with modifications

      "teamCode": "LAL",
      "teamName": "Los Angeles Lakers",
      "season": "2025-26",

      // ← Roster changed (Reaves out, Poole in)
      "roster": [
        "lebron_james",
        "anthony_davis",
        "jordan_poole",  // ← NEW
        // ... no austin_reaves
      ],

      "deadCap": [
        // Same as base (unless player waived in this world)
      ],

      "capHolds": [
        // Updated if rights renounced in this world
      ],

      "exceptions": {
        // Updated if exceptions used in this world
        "mle": {
          "type": "Non-Taxpayer",
          "available": true,
          "totalAmount": 12900000,
          "usedAmount": 5000000,  // ← Increased if used
          "remainingAmount": 7900000,
          "expiresOn": "2026-06-30"
        }
        // ... etc
      },

      "draftPicks": [
        // Updated if picks traded in this world
      ],

      "totals": {
        // Recalculated based on new roster
        "totalSalary": 195000000,  // ← Changed
        "capSpace": -18750000,
        // ... all totals recalculated
      },

      // Metadata shows this is a snapshot
      "source": {
        "type": "world-snapshot",
        "worldId": "world_abc123",
        "generatedAt": "2025-10-14T09:30:00Z",
        "baseTeamVersion": "2025-10-14T05:00:00Z"
      },
      "lastUpdated": "2025-10-14T09:30:00Z"
    }

**Size Estimate:** ~50KB per modified team = **100KB for 2-team trade**

---

## 6. World Player Override (Optional - Advanced)

**Path:** `/architect/worlds/world_abc123/snapshot/teams/LAL/players/jordan_poole`

**Use Case:** Player contract was modified (extension, option picked up, etc.)

    {
      "playerId": "jordan_poole",

      // Only fields that changed from base
      "overrides": {
        "contract": {
          "salariesByYear": [
            // Only years that changed
            {
              "season": "2027-28",
              "salary": 27000000,
              "capHit": 27000000,
              "guaranteed": true,  // ← Picked up option
              "guaranteedAmount": 27000000,
              "option": null,  // ← Changed from "PO" to null
              "tradeBonus": null,
              "incentives": { "likely": 0, "unlikely": 0 }
            }
          ]
        }
      },

      "source": {
        "type": "player-override",
        "worldId": "world_abc123",
        "modifiedAt": "2025-10-14T10:00:00Z",
        "reason": "Picked up player option"
      }
    }

**Note:** This is OPTIONAL and only needed for player-level contract changes. Most trades don't need this.

---

## Summary: Storage Breakdown

### Base Collections (One-Time)

- `baseTeams/`: 30 teams × 50KB = **1.5 MB**
- `basePlayers/`: 530 players × 5KB = **2.65 MB**
- **Total Base:** **~4 MB** (never changes after initial load)

### Per World

- `metadata`: 1 doc × 2KB = **2 KB**
- `snapshot/teams/`: 2-4 teams × 50KB = **100-200 KB**
- `snapshot/.../players/`: 0-5 players × 5KB = **0-25 KB** (rare)
- **Total Per World:** **~150 KB typical, 250 KB max**

### 50 Worlds

- Base: 4 MB (shared)
- Worlds: 50 × 150 KB = **7.5 MB**
- **Total:** **~12 MB** (very manageable)

---

---

## Field Reference Notes

### Per-Year Salary Fields

**Standard Fields** (all years):

- `season`, `salary`, `capHit`, `guaranteed`, `guaranteedAmount`, `option`, `tradeBonus`, `incentives`

**Optional Fields** (present when relevant):

- `optionUsed`: `null` (not decided), `true` (picked up), `false` (declined)
- `optionDecisionDate`: Date string when option decision made
- `guaranteeSchedule`: Array of `{effectiveDate, guaranteedAmount, status, note}` for partial guarantees
- `voidedByExtension`: `true` if this year voided by extension
- `voidedOn`: Date string when voided

### Contract Metadata Fields

**Max Contract Tracking**:

- `isMaxContract`: `true` if on max contract
- `maxType`: `"25%"` | `"30%"` | `"35%"` for max tier
- `estimatedCapPercentage`: Estimated percentage of cap

**Extension Relationships**:

- `supersededIn`: Season when replaced by extension
- `supersededByContractRef`: Reference to replacement contract
- `supersedesContractRef`: Reference to contract this supersedes

### Trade Eligibility

**Important**: `canBeTradedNow` is always `null` in the base schema. Trade eligibility is determined at runtime based on other fields (signingDate, restrictedUntil, etc.)

---

## Next: See Implementation Plan

See `07-IMPLEMENTATION-PLAN.md` for how to build this structure.
