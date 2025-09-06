# Comprehensive SalarySwish Data Extraction Guide

## Overview

This system extracts **ALL** available salary cap data from SalarySwish.com, providing complete contract details, exceptions, cap statistics, draft picks, and more - everything needed for comprehensive NBA salary cap management.

## What Data Is Extracted

### 🏀 Player Contracts (Complete Details)
For each player on every roster section (Active, Training Camp, G-League, RFAs, UFAs, etc.):
- **Salary Breakdown by Year**: Cap hit, guaranteed money, base salary, incentives for each contract year
- **Contract Options**: Player options (P), Team options (T) clearly identified
- **Free Agency Status**: UFA, RFA with exact classifications
- **Bird Rights**: Full Bird, Early Bird, Non-Bird rights for each player
- **Contract Terms**: Max contracts, Rookie Scale (RSC), MLE signings, etc.
- **Player Details**: Age, position, acquisition method (Draft, Trade, Signed)

### 📋 Trade Exceptions
- **Exception Amounts**: Full dollar amounts available
- **Usage Tracking**: Amount used vs. remaining
- **Expiration Dates**: Start and end dates for each TPE
- **Player Source**: Which player generated each exception

### 🎯 Draft Picks (Complete Tracking)
- **Owned Picks**: Round 1 and Round 2 picks by year through 2032
- **Traded Picks**: Which picks have been traded away
- **Conditional Picks**: Picks with trade conditions
- **Pick Status**: Contention, protections, swap rights

### ⚖️ Cap Holds & Free Agents  
- **Free Agent Cap Holds**: Dollar amounts for each RFA/UFA
- **Player Details**: Age, position for each cap hold
- **Bird Rights Status**: Classification for each free agent

### 💰 Salary Cap Statistics (Multi-Year)
- **Current Season**: Cap hit, cap room, luxury tax status
- **Future Projections**: Cap hits and room through 2030-31
- **Apron Status**: First apron, second apron levels
- **Hard Cap**: Active hard cap restrictions
- **Salary Floor**: Minimum salary requirements

### 🎫 Signing Exceptions
- **Mid-Level Exception (MLE)**: Available amounts and terms
- **Bi-Annual Exception (BAE)**: Usage and availability
- **Room Exception**: Available for teams under cap
- **Other Exceptions**: Various signing mechanisms

## How To Use

### Single Team Testing
```bash
node data_pipeline/targeted_salaryswish_scraper.cjs --team hawks
```

### Multiple Teams Testing
```bash
node data_pipeline/targeted_salaryswish_scraper.cjs --teams hawks,celtics,warriors,lakers,heat
```

### Expected Output Structure
```json
{
  "metadata": {
    "scrapedAt": "2025-01-06T...",
    "totalTeams": 30,
    "dataVersion": "comprehensive"
  },
  "teams": {
    "hawks": {
      "metadata": {
        "name": "Atlanta Hawks",
        "slug": "hawks",
        "scrapedAt": "..."
      },
      "players": [
        {
          "name": "Trae Young",
          "status": "Active List",
          "acquired": "Draft",
          "age": 26,
          "position": "PG",
          "contractTerms": "Max",
          "contractDetails": {},
          "salaries": {
            "2025-26": {
              "capHit": 45999660,
              "guaranteed": 45999660,
              "baseSalary": 45999660,
              "incentives": 0
            },
            "2026-27": {
              "capHit": 48967380,
              "guaranteed": 48967380,
              "baseSalary": 48967380,
              "incentives": 0
            }
          },
          "freeAgencyStatus": "UFA",
          "birdRights": "Full Bird Rights",
          "options": {
            "2026-27": "Player Option"
          }
        }
      ],
      "tradeExceptions": [
        {
          "player": "Bogdan Bogdanovic",
          "amount": 13101561,
          "used": 0,
          "remaining": 13101561,
          "startDate": "Feb 6, 2025",
          "endDate": "Feb 6, 2026"
        }
      ],
      "draftPicks": {
        "owned": {
          "2026": {
            "round1": [{"round": 1, "status": "owned"}],
            "round2": []
          }
        },
        "traded": {
          "2026": {
            "round2": [{"round": 2, "status": "traded", "title": "Pick traded..."}]
          }
        }
      },
      "capHolds": [
        {
          "player": "Free Agent Name",
          "amount": 2500000,
          "status": "RFA",
          "age": 25,
          "position": "SG"
        }
      ],
      "capStatistics": {
        "capHit": 184432415,
        "capRoom": -29785415,
        "luxuryTaxRoom": -35000000,
        "hardCap": null,
        "apronStatus": {"firstApron": "At or Above"},
        "years": {
          "2026-27": {
            "capHit": 143256969,
            "salaryCap": 165472000
          }
        }
      },
      "exceptions": {
        "trade": [...],
        "signing": {
          "midLevel": 12400000,
          "biAnnual": 4700000,
          "room": 7200000
        }
      }
    }
  }
}
```

## Benefits Over Previous Approach

### ✅ Complete Data Coverage
- **8 High-Priority Tables**: All identified salary cap tables extracted
- **Contract Details**: Cap hit, guaranteed money, base salary, incentives
- **Option Tracking**: Player/team options with clear identification
- **Bird Rights**: Complete classification system
- **Multi-Year Coverage**: Through 2030-31 season

### ✅ Efficiency 
- **30 Total Requests**: One per team vs. 60+ with Spotrac
- **Single Page Source**: All data from one SalarySwish page per team
- **Comprehensive Structure**: No need for multiple endpoint calls

### ✅ Data Quality
- **Rich HTML Parsing**: Extracts from complex table structures with full context
- **Option Recognition**: Identifies P/T options from HTML classes
- **Status Classification**: Proper free agency and bird rights parsing
- **Future-Proof**: Handles all table variations found in analysis

## File Outputs

Final comprehensive data is saved to:
```
data_pipeline/output/salaryswish_contracts_TIMESTAMP.json
```

This file contains complete salary cap data for all tested teams with full contract details, exceptions, cap statistics, draft picks, and free agent information.

## Next Steps

1. **Test with Hawks**: Verify complete data extraction
2. **Test Multiple Teams**: Validate consistency across teams  
3. **Scale to All 30 Teams**: Run full league extraction
4. **Integration**: Connect to Firebase upload pipeline

This comprehensive approach ensures you have ALL the salary cap data needed for complete NBA team management.