# Atlanta Hawks - Comprehensive Data Analysis Report

## Data Inventory Summary
- **Total Tables Found:** 3
- **Total Sections:** 1  
- **Salary Elements:** 2
- **Contract Elements:** 1
- **Cap Elements:** 1
- **Exception Elements:** 1
- **Draft Elements:** 0

## High-Value Tables (MUST EXTRACT)

### Table 0 (Score: 503)
- **Classes:** roster-table active-roster
- **Size:** 16x8
- **Headers:** Player, Position, Age, 2025-26, 2026-27, 2027-28, 2028-29, 2029-30
- **Data Types:** salary, player
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
Jalen Johnson | PF, SF | 23 | $30,000,000 | $30,000,000
Trae Young | PG | 26 | $43,031,940 | $46,494,496
```

### Table 1 (Score: 286)
- **Classes:** cap-stats-table
- **Size:** 6x6
- **Headers:** Year, Team Salary, Salary Cap, Cap Room, Luxury Tax, Tax Room
- **Data Types:** salary, player, contract
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
2025-26 | $184,432,415 | $214,217,830 | $29,785,415 | $187,680,245
```


## Medium-Value Tables (SHOULD EXTRACT)  

### Table 2 (Score: 187)
- **Classes:** trade-exceptions-table
- **Size:** 2x6
- **Headers:** Player, Amount, Used, Remaining, Start Date, End Date
- **Recommendation:** SHOULD EXTRACT - Contains valuable salary or contract data


## Salary Cap Data Analysis
- **Years Covered:** 2025-26, 2026-27, 2027-28, 2028-29, 2029-30
- **Salary Elements Found:** 2
- **Cap Space References:** 0
- **Luxury Tax References:** 0

### Salary Distribution
- **Under $1M:** undefined
- **$1M-$5M:** undefined
- **$5M-$15M:** undefined
- **$15M-$30M:** undefined
- **Over $30M:** undefined

## Extraction Recommendations

### 📋 Extraction Strategy: FOCUSED_EXTRACTION
Several high-value tables found. Focus on critical tables first.

### 📊 Extraction Coverage
- **Critical Tables:** 2 
- **Valuable Tables:** 1
- **Supplementary Tables:** 0
- **Coverage:** 3/3

### 🎯 Priority Order
1. **Table 0** (CRITICAL, Score: 503)
   - Headers: Player, Position, Age...
   - Reason: Contains critical salary cap data with multi-year information
2. **Table 1** (CRITICAL, Score: 286)
   - Headers: Year, Team Salary, Salary Cap...
   - Reason: Contains critical salary cap data with multi-year information
3. **Table 2** (VALUABLE, Score: 187)
   - Headers: Player, Amount, Used...
   - Reason: Contains valuable salary or contract data

## What This Means
Based on this analysis, you should:

1. **DEFINITELY EXTRACT** the 2 high-value tables - these contain critical salary cap data
2. **CONSIDER EXTRACTING** the 1 medium-value tables based on your specific needs
3. **SKIP** the 0 low-value tables to keep the scraper focused

The recommended approach is **FOCUSED_EXTRACTION** with 2 extraction phases.

---
*Report generated on 2025-09-07T06:44:41.263Z*
