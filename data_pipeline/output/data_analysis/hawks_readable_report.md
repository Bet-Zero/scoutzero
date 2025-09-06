# Atlanta Hawks - Comprehensive Data Analysis Report

## Data Inventory Summary
- **Total Tables Found:** 13
- **Total Sections:** 624  
- **Salary Elements:** 0
- **Contract Elements:** 0
- **Cap Elements:** 0
- **Exception Elements:** 0
- **Draft Elements:** 0

## High-Value Tables (MUST EXTRACT)

### Table 2 (Score: 567)
- **Classes:** sw_teamProfileRosterSection__table sw_table__collapsiblePlayerColumn sw_table__default sw_table__fixed sw_table__stickyFirstColumn
- **Size:** 16x12
- **Headers:** Active (14 - $184,432,415), Status, Acquired, Age, Pos, Terms, 2025-26, 2026-27, 2027-28, 2028-29, 2029-30, 2030-31
- **Data Types:** salary, player
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
Active (14 - $184,432,415) | Status | Acquired | Age | Pos
Young, Trae | Active List | Draft | 26 | PG
Porzingis, Kristaps | Active List | Trade | 30 | PF
```

### Table 9 (Score: 531)
- **Classes:** sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn
- **Size:** 13x12
- **Headers:** RFAs (11 - $0), Status, Acquired, Age, Pos, Terms, 2025-26, 2026-27, 2027-28, 2028-29, 2029-30, 2030-31
- **Data Types:** salary, player
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
RFAs (11 - $0) | Status | Acquired | Age | Pos
Daniels, Dyson | RFA |  | 22 | SG, SF
Butler, Lamont | RFA |  | 23 | PG
```

### Table 10 (Score: 507)
- **Classes:** sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn
- **Size:** 11x12
- **Headers:** UFAs (9 - $0), Status, Acquired, Age, Pos, Terms, 2025-26, 2026-27, 2027-28, 2028-29, 2029-30, 2030-31
- **Data Types:** salary, player
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
UFAs (9 - $0) | Status | Acquired | Age | Pos
Porzingis, Kristaps | UFA |  | 30 | PF
Kennard, Luke | UFA |  | 29 | SG
```

### Table 4 (Score: 447)
- **Classes:** sw_teamProfileRosterSection__table sw_table__collapsiblePlayerColumn sw_table__default sw_table__fixed sw_table__stickyFirstColumn
- **Size:** 6x12
- **Headers:** Minors/G-League (4 - $0), Status, Acquired, Age, Pos, Terms, 2025-26, 2026-27, 2027-28, 2028-29, 2029-30, 2030-31
- **Data Types:** salary, player
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
Minors/G-League (4 - $0) | Status | Acquired | Age | Pos
Butler, Lamont | Minors/G-League | Signed | 23 | PG
N'Diaye, Eli John | Minors/G-League | Signed | 21 | C
```

### Table 8 (Score: 447)
- **Classes:** sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn
- **Size:** 6x12
- **Headers:** 2nd Rd Picks (4 - $0), Status, Acquired, Age, Pos, Terms, 2025-26, 2026-27, 2027-28, 2028-29, 2029-30, 2030-31
- **Data Types:** salary, player
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
2nd Rd Picks (4 - $0) | Status | Acquired | Age | Pos
Binelli, Augusto (40th pick 1986) | Hold |  | 60 | C
Digbeu, Alain (49th pick 1997) | Hold |  | 49 | SF
```

### Table 11 (Score: 447)
- **Classes:** sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn
- **Size:** 6x12
- **Headers:** FA Cap Hold (4 - $8,937,316), Status, Acquired, Age, Pos, Terms, 2025-26, 2026-27, 2027-28, 2028-29, 2029-30, 2030-31
- **Data Types:** salary, player
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
FA Cap Hold (4 - $8,937,316) | Status | Acquired | Age | Pos
Mathews, Garrison | FA Cap Hold |  | 28 | SG
Matthews, Wesley | FA Cap Hold |  | 38 | SF, SG
```

### Table 3 (Score: 423)
- **Classes:** sw_teamProfileRosterSection__table sw_table__collapsiblePlayerColumn sw_table__default sw_table__fixed sw_table__stickyFirstColumn
- **Size:** 4x12
- **Headers:** Training Camp and Exhibit 10 (2 - $0), Status, Acquired, Age, Pos, Terms, 2025-26, 2026-27, 2027-28, 2028-29, 2029-30, 2030-31
- **Data Types:** salary, player
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
Training Camp and Exhibit 10 (2 - $0) | Status | Acquired | Age | Pos
Johnson, Kobe | Training Camp and Exhibit 10 | Signed | 22 | PG, SG
Houstan, Caleb | Training Camp and Exhibit 10 | Signed | 22 | SF, SG
```

### Table 7 (Score: 319)
- **Classes:** sw_teamProfileStats__table sw_table__collapsiblePlayerColumn sw_table__fixed rel
- **Size:** 12x12
- **Headers:** , , , , , CAP, $154,647,000, $165,472,000, $182,019,000, $200,221,000, $220,243,000, $242,267,000
- **Data Types:** salary, player
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
 |  |  |  | 
 |  |  |  | 

```

### Table 0 (Score: 284)
- **Classes:** sw_table__tradeExptn sw_table__default sw_table__fixed sw_table__sortable sw_table__collapsibleTeamColumn
- **Size:** 4x6
- **Headers:** Player, Exception, Used, Remaining, Start Date, End Date
- **Data Types:** salary, player, exception
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
Player | Exception | Used | Remaining | Start Date
Bogdan Bogdanovic | $13,101,561 | $0 | $13,101,561 | Feb 6, 2025
Cody Zeller | $3,500,000 | $0 | $3,500,000 | Feb 6, 2025
```

### Table 6 (Score: 283)
- **Classes:** sw_teamProfileStats__table sw_table__collapsiblePlayerColumn sw_table__fixed rel
- **Size:** 9x12
- **Headers:** , , , , , ROSTER CAP HIT, $184,432,415, $143,256,969, $88,568,302, $51,962,703, $30,000,000, -
- **Data Types:** salary, player
- **Recommendation:** MUST EXTRACT - Contains critical salary cap data with multi-year information

**Sample Data:**
```
 |  |  |  | 
 |  |  |  | 
 |  |  |  | 
```


## Medium-Value Tables (SHOULD EXTRACT)  

### Table 5 (Score: 198)
- **Classes:** sw_teamProfileStats__table sw_table__collapsiblePlayerColumn sw_table__fixed rel
- **Size:** 4x12
- **Headers:** , , , , , ROSTER SIZE, 20, 11, 7, 3, 1, -
- **Recommendation:** SHOULD EXTRACT - Contains valuable salary or contract data

### Table 1 (Score: 99)
- **Classes:** sw_table__default sw_table__fixed sw_table__stickyFirstColumn
- **Size:** 3x8
- **Headers:** Draft, 2026, 2027, 2028, 2029, 2030, 2031, 2032
- **Recommendation:** CONSIDER EXTRACTING - May contain useful supplementary data


## Salary Cap Data Analysis
- **Years Covered:** 2025-26, 2026-27, 2027-28, 2028-29, 2029-30, 2030-31
- **Salary Elements Found:** 20
- **Cap Space References:** 0
- **Luxury Tax References:** 0

### Salary Distribution
- **Under $1M:** undefined
- **$1M-$5M:** undefined
- **$5M-$15M:** undefined
- **$15M-$30M:** undefined
- **Over $30M:** undefined

## Extraction Recommendations

### 📋 Extraction Strategy: COMPREHENSIVE_EXTRACTION
Many high-value tables found. Extract all critical and valuable tables.

### 📊 Extraction Coverage
- **Critical Tables:** 10 
- **Valuable Tables:** 1
- **Supplementary Tables:** 1
- **Coverage:** 11/13

### 🎯 Priority Order
1. **Table 2** (CRITICAL, Score: 567)
   - Headers: Active (14 - $184,432,415), Status, Acquired...
   - Reason: Contains critical salary cap data with multi-year information
2. **Table 9** (CRITICAL, Score: 531)
   - Headers: RFAs (11 - $0), Status, Acquired...
   - Reason: Contains critical salary cap data with multi-year information
3. **Table 10** (CRITICAL, Score: 507)
   - Headers: UFAs (9 - $0), Status, Acquired...
   - Reason: Contains critical salary cap data with multi-year information
4. **Table 4** (CRITICAL, Score: 447)
   - Headers: Minors/G-League (4 - $0), Status, Acquired...
   - Reason: Contains critical salary cap data with multi-year information
5. **Table 8** (CRITICAL, Score: 447)
   - Headers: 2nd Rd Picks (4 - $0), Status, Acquired...
   - Reason: Contains critical salary cap data with multi-year information
6. **Table 11** (CRITICAL, Score: 447)
   - Headers: FA Cap Hold (4 - $8,937,316), Status, Acquired...
   - Reason: Contains critical salary cap data with multi-year information
7. **Table 3** (CRITICAL, Score: 423)
   - Headers: Training Camp and Exhibit 10 (2 - $0), Status, Acquired...
   - Reason: Contains critical salary cap data with multi-year information
8. **Table 7** (CRITICAL, Score: 319)
   - Headers: , , ...
   - Reason: Contains critical salary cap data with multi-year information
9. **Table 0** (CRITICAL, Score: 284)
   - Headers: Player, Exception, Used...
   - Reason: Contains critical salary cap data with multi-year information
10. **Table 6** (CRITICAL, Score: 283)
   - Headers: , , ...
   - Reason: Contains critical salary cap data with multi-year information

## What This Means
Based on this analysis, you should:

1. **DEFINITELY EXTRACT** the 10 high-value tables - these contain critical salary cap data
2. **CONSIDER EXTRACTING** the 1 medium-value tables based on your specific needs
3. **SKIP** the 1 low-value tables to keep the scraper focused

The recommended approach is **COMPREHENSIVE_EXTRACTION** with 3 extraction phases.

---
*Report generated on 2025-09-06T13:11:50.478Z*
