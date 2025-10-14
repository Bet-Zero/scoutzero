# Architect Firestore Schema v2 - Sample Schemas

## 1. Base Team Schema
**Path**: `/architect/baseTeams/{teamCode}`

### Example: Los Angeles Lakers (LAL)
```json
{
  "teamCode": "LAL",
  "teamName": "Los Angeles Lakers",
  "season": "2025-26",
  
  "roster": [
    "lebron_james",
    "anthony_davis", 
    "austin_reaves",
    "rui_hachimura",
    "dangelo_russell",
    "jarred_vanderbilt",
    "gabe_vincent",
    "max_christie",
    "jalen_hood_schifino"
  ],
  
  "deadCap": [
    {
      "playerId": "waived_vet",
      "amount": 1500000,
      "seasons": ["2025-26"]
    }
  ],
  
  "capHolds": [
    {
      "playerId": "rfa_guard",
      "amount": 9000000,
      "type": "Non-Bird"
    }
  ],
  
  "exceptions": {
    "mle": {
      "available": true,
      "amount": 12500000,
      "used": 3000000,
      "expires": "2026-07-01"
    },
    "bae": {
      "available": false,
      "used": 0
    },
    "tpe": [
      {
        "id": "tpe_xyz",
        "amount": 7200000,
        "expires": "2026-02-10"
      }
    ]
  },
  
  "draftPicks": [
    {
      "year": 2026,
      "round": 1,
      "owned": true,
      "notes": "Top-4 protected via NOP"
    },
    {
      "year": 2027,
      "round": 2,
      "owned": false,
      "notes": "Sent to WAS"
    }
  ],
  
  "totals": {
    "totalSalary": 180200000,
    "capSpace": 4250000,
    "firstApronRoom": -3500000,
    "secondApronRoom": 9000000,
    "isOverCap": true,
    "isFirstApron": true,
    "isSecondApron": false,
    "isHardCapped": false
  },
  
  "source": {
    "provider": "SalarySwish",
    "fetchedAt": "2025-09-30T05:00:00Z"
  }
}
```

---

## 2. Base Player Schema
**Path**: `/architect/basePlayers/{playerId}`

### Example: Jordan Poole
```json
{
  "playerId": "jordan_poole",
  "displayName": "Jordan Poole",
  
  "bio": {
    "position": "G",
    "dob": "1999-06-19",
    "height": "6-4",
    "weight": 194
  },
  
  "contract": {
    "seasons": [
      {
        "season": "2025-26",
        "salary": 25000000,
        "guaranteed": true
      },
      {
        "season": "2026-27",
        "salary": 26000000,
        "guaranteed": true
      },
      {
        "season": "2027-28",
        "salary": 27000000,
        "guaranteed": false,
        "option": {
          "type": "PO"
        }
      }
    ],
    
    "fa": {
      "type": "UFA",
      "year": 2028
    },
    
    "birdRights": {
      "type": "Bird",
      "yearsWithTeam": 2,
      "exceptionsEligible": ["MLE"]
    }
  },
  
  "source": {
    "provider": "SalarySwish",
    "fetchedAt": "2025-09-30T05:00:00Z"
  }
}
```

---

## 3. World Team Document Schema
**Path**: `/architect/worlds/{worldId}/teams/{teamCode}/teamDoc`

### Example: LAL in World A (after trading for Jordan Poole)
```json
{
  "teamCode": "LAL",
  "season": "2025-26",
  
  "roster": [
    "lebron_james",
    "anthony_davis",
    "jordan_poole",
    "rui_hachimura",
    "dangelo_russell",
    "jarred_vanderbilt",
    "gabe_vincent",
    "max_christie",
    "jalen_hood_schifino"
  ],
  
  "overrides": {
    "deadCap": [
      {
        "playerId": "waived_vet",
        "amount": 1500000,
        "seasons": ["2025-26"]
      }
    ],
    "capHolds": [],
    "exceptions": {
      "mle": {
        "used": 5000000
      }
    },
    "draftPicks": [
      {
        "year": 2027,
        "round": 2,
        "owned": true,
        "notes": "via NOP"
      }
    ]
  },
  
  "totalsCache": {
    "totalSalary": 192200000,
    "capSpace": -5400000,
    "firstApronRoom": -7400000,
    "secondApronRoom": 1200000,
    "isOverCap": true,
    "isFirstApron": true,
    "isSecondApron": false,
    "isHardCapped": false
  },
  
  "updatedAt": "2025-10-07T15:00:00Z"
}
```

---

## 4. World Player Override Schema
**Path**: `/architect/worlds/{worldId}/teams/{teamCode}/players/{playerId}`

### Example: Jordan Poole extension in World A
```json
{
  "playerId": "jordan_poole",
  
  "overrides": {
    "contract": {
      "seasons": [
        {
          "season": "2026-27",
          "salary": 28500000
        },
        {
          "season": "2027-28",
          "salary": 29500000,
          "option": {
            "type": "PO"
          }
        }
      ],
      "fa": {
        "type": "UFA",
        "year": 2029
      },
      "birdRights": {
        "type": "Bird",
        "yearsWithTeam": 3
      }
    }
  },
  
  "teamCode": "LAL",
  "updatedAt": "2025-10-07T15:05:00Z"
}
```

---

## 5. Worked Example: Simple Trade

### Scenario
LAL trades Austin Reaves to NOP for Jordan Poole. No contract changes.

### Firestore Writes

#### Document 1: LAL Team Doc
**Path**: `/architect/worlds/world_A/teams/LAL/teamDoc`
```json
{
  "teamCode": "LAL",
  "season": "2025-26",
  "roster": [
    "lebron_james",
    "anthony_davis",
    "jordan_poole",
    "rui_hachimura",
    "dangelo_russell",
    "jarred_vanderbilt",
    "gabe_vincent",
    "max_christie",
    "jalen_hood_schifino"
  ],
  "overrides": {},
  "totalsCache": {
    "totalSalary": 185000000,
    "capSpace": -2500000,
    "firstApronRoom": -4500000,
    "secondApronRoom": 8000000,
    "isOverCap": true,
    "isFirstApron": true,
    "isSecondApron": false,
    "isHardCapped": false
  },
  "updatedAt": "2025-10-07T14:30:00Z"
}
```

#### Document 2: NOP Team Doc
**Path**: `/architect/worlds/world_A/teams/NOP/teamDoc`
```json
{
  "teamCode": "NOP",
  "season": "2025-26",
  "roster": [
    "zion_williamson",
    "brandon_ingram",
    "cj_mccollum",
    "austin_reaves",
    "herbert_jones",
    "trey_murphy_iii",
    "larry_nance_jr"
  ],
  "overrides": {},
  "totalsCache": {
    "totalSalary": 156000000,
    "capSpace": 12000000,
    "firstApronRoom": 8000000,
    "secondApronRoom": 22000000,
    "isOverCap": true,
    "isFirstApron": false,
    "isSecondApron": false,
    "isHardCapped": false
  },
  "updatedAt": "2025-10-07T14:30:00Z"
}
```

**Note**: No player override documents needed because contracts didn't change.

---

## 6. Worked Example: Extension After Trade

### Scenario  
Continuing from above, LAL extends Jordan Poole for 2 more years.

### Additional Firestore Write

#### Document 3: Jordan Poole Override
**Path**: `/architect/worlds/world_A/teams/LAL/players/jordan_poole`
```json
{
  "playerId": "jordan_poole",
  "overrides": {
    "contract": {
      "seasons": [
        {
          "season": "2028-29",
          "salary": 30000000,
          "guaranteed": true
        },
        {
          "season": "2029-30",
          "salary": 31000000,
          "guaranteed": true
        }
      ],
      "fa": {
        "type": "UFA",
        "year": 2030
      }
    }
  },
  "teamCode": "LAL",
  "updatedAt": "2025-10-07T15:30:00Z"
}
```

#### Updated: LAL Team Doc (totals recalculated)
**Path**: `/architect/worlds/world_A/teams/LAL/teamDoc`
```json
{
  "teamCode": "LAL",
  "season": "2025-26",
  "roster": ["lebron_james", "anthony_davis", "jordan_poole", "..."],
  "overrides": {},
  "totalsCache": {
    "totalSalary": 185000000,
    "capSpace": -2500000,
    "firstApronRoom": -4500000,
    "secondApronRoom": 8000000,
    "isOverCap": true,
    "isFirstApron": true,
    "isSecondApron": false,
    "isHardCapped": false
  },
  "updatedAt": "2025-10-07T15:30:00Z"
}
```

**Note**: Current year totals don't change (extension is for future years), but document timestamp updates to track latest modification.
