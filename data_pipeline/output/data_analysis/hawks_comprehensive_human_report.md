# Atlanta Hawks - Complete NBA Salary Cap Data Analysis

## 📊 Executive Summary

**What We Found:** SalarySwish contains comprehensive NBA salary cap management data including:
- **Trade Exceptions**: Active TPEs with dollar amounts, usage tracking, and expiration dates  
- **Multi-Year Contracts**: Player salaries through 2030-31 season with guaranteed money details
- **Roster Management**: Active players, training camp, G-League, second round picks
- **Free Agency**: RFA/UFA classifications, cap holds, bird rights status
- **Salary Cap**: Team payroll, cap room, luxury tax status, apron levels
- **Draft Picks**: Future pick obligations and trade protections

**Bottom Line:** This is a complete salary cap management dashboard that provides everything needed for NBA front office operations.

---

## 🎯 Key Data Tables Available


### Trade Exceptions (Table 0)
**What it contains:** Active trade exceptions with dollar amounts, usage tracking, and expiration dates. Critical for understanding available trade flexibility.
**Data types:** 💰 Salary Data, 🎫 Trade Exceptions
**Size:** 4 rows × 6 columns
**Sample data preview:**
```
Player | Exception | Used | Remaining | Start Date | ...
--- | --- | --- | --- | --- | ---
Bogdan Bogdanovic | $13,101,561 | $0 | $13,101,561 | Feb 6, 2025 | ...
Cody Zeller | $3,500,000 | $0 | $3,500,000 | Feb 6, 2025 | ...
Clint Capela | $6,700,000 | $0 | $6,700,000 | Jul 6, 2025 | ...
```


### Active Player Contracts (Table 2)
**What it contains:** Complete roster with multi-year salary projections through 2030-31, including guaranteed money and contract options.
**Data types:** 💰 Salary Data, 📅 Multi-Year Data, 📊 Multiple Players, 👤 Player Info
**Size:** 16 rows × 12 columns
**Sample data preview:**
```
Active (14 - $184,432,415) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Young, Trae | Active List | Draft | 26 | PG | ...
Porzingis, Kristaps | Active List | Trade | 30 | PF | ...
Johnson, Jalen | Active List | Draft | 23 | PF, SF | ...
```


### Training Camp & Exhibit 10 Players (Table 3)
**What it contains:** Non-guaranteed players in training camp with contract details and potential roster spots.
**Data types:** 💰 Salary Data, 📅 Multi-Year Data, 👤 Player Info
**Size:** 4 rows × 12 columns
**Sample data preview:**
```
Training Camp and Exhibit 10 (2 - $0) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Johnson, Kobe | Training Camp and Ex | Signed | 22 | PG, SG | ...
Houstan, Caleb | Training Camp and Ex | Signed | 22 | SF, SG | ...
TOTAL |  |  | 22.0 |  | ...
```


### G-League & Minor League Players (Table 4)
**What it contains:** Affiliated players in development system with two-way and G-League contract details.
**Data types:** 💰 Salary Data, 📅 Multi-Year Data, 📊 Multiple Players, 👤 Player Info
**Size:** 6 rows × 12 columns
**Sample data preview:**
```
Minors/G-League (4 - $0) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Butler, Lamont | Minors/G-League | Signed | 23 | PG | ...
N'Diaye, Eli John | Minors/G-League | Signed | 21 | C | ...
Toppin, Jacob | Minors/G-League | Signed | 25 | SF | ...
```


### Salary Cap Statistics (Table 6)
**What it contains:** Team payroll, cap room, luxury tax projections, and multi-year salary cap planning data.
**Data types:** 💰 Salary Data, 📊 Multiple Players
**Size:** 9 rows × 12 columns
**Sample data preview:**
```
 |  |  |  |  | ...
--- | --- | --- | --- | --- | ---
 |  |  |  |  | ...
 |  |  |  |  | ...
 |  |  |  |  | ...
```


### Salary Cap Statistics (Table 7)
**What it contains:** Team payroll, cap room, luxury tax projections, and multi-year salary cap planning data.
**Data types:** 💰 Salary Data, 📊 Multiple Players
**Size:** 12 rows × 12 columns
**Sample data preview:**
```
 |  |  |  |  | ...
--- | --- | --- | --- | --- | ---
 |  |  |  |  | ...

 |  |  |  |  | ...
```


### Second Round Picks (Table 8)
**What it contains:** Draft picks and rookie contracts with team options and development timelines.
**Data types:** 💰 Salary Data, 📅 Multi-Year Data, 📊 Multiple Players, 👤 Player Info
**Size:** 6 rows × 12 columns
**Sample data preview:**
```
2nd Rd Picks (4 - $0) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Binelli, Augusto (40 | Hold |  | 60 | C | ...
Digbeu, Alain (49th  | Hold |  | 49 | SF | ...
Eriksson, Marcus (50 | Hold |  | 31 | PG | ...
```


### Restricted Free Agents (Table 9)
**What it contains:** Players with restricted free agency status, qualifying offers, and cap hold amounts.
**Data types:** 💰 Salary Data, 📅 Multi-Year Data, 📊 Multiple Players, 👤 Player Info
**Size:** 13 rows × 12 columns
**Sample data preview:**
```
RFAs (11 - $0) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Daniels, Dyson | RFA |  | 22 | SG, SF | ...
Butler, Lamont | RFA |  | 23 | PG | ...
Johnson, Kobe | RFA |  | 22 | PG, SG | ...
```


### Unrestricted Free Agents (Table 10)
**What it contains:** Unrestricted free agents with cap holds and bird rights classifications.
**Data types:** 💰 Salary Data, 📅 Multi-Year Data, 📊 Multiple Players, 👤 Player Info
**Size:** 11 rows × 12 columns
**Sample data preview:**
```
UFAs (9 - $0) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Porzingis, Kristaps | UFA |  | 30 | PF | ...
Kennard, Luke | UFA |  | 29 | SG | ...
Houstan, Caleb | UFA |  | 22 | SF, SG | ...
```


### Free Agent Cap Holds (Table 11)
**What it contains:** Cap holds for free agents with dollar amounts and bird rights status affecting salary cap.
**Data types:** 💰 Salary Data, 📅 Multi-Year Data, 📊 Multiple Players, 👤 Player Info
**Size:** 6 rows × 12 columns
**Sample data preview:**
```
FA Cap Hold (4 - $8,937,316) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Mathews, Garrison | FA Cap Hold |  | 28 | SG | ...
Matthews, Wesley | FA Cap Hold |  | 38 | SF, SG | ...
Forrest, Trent | FA Cap Hold |  | 27 | PG, SG | ...
```



---

## 💰 Salary Cap Information Available

**Salary Data Found:**
- 20 salary amounts identified
- Years covered: 2025-26, 2026-27, 2027-28, 2028-29, 2029-30, 2030-31
- Contract data spans 6 seasons

**Key Financial Elements:**
- Salary range: $0 - $193,369,731
- 19 contracts over $1M
- 15 contracts over $10M


---

## 📅 Timeline Coverage

**Years with Data:** 2025-26, 2026-27, 2027-28, 2028-29, 2029-30, 2030-31

**Contract Coverage:** Complete multi-year salary projections through 2030-31 season, including:
- Base salaries for each season
- Guaranteed money tracking  
- Player and team option years
- Contract expiration dates
- Free agency classifications

---

## 🔍 Detailed Table Breakdown


#### Table 0: Trade Exceptions

**Technical Details:**
- CSS Classes: `sw_table__tradeExptn sw_table__default sw_table__fixed sw_table__sortable sw_table__collapsibleTeamColumn`
- Table ID: `sw_table__tradeExptn_tm`  
- Size: 4 rows × 6 columns

**Headers:**
- Player
- Exception
- Used
- Remaining
- Start Date
- End Date

**Data Structure:**
```
Player | Exception | Used | Remaining | Start Date | ...
--- | --- | --- | --- | --- | ---
Bogdan Bogdanovic | $13,101,561 | $0 | $13,101,561 | Feb 6, 2025 | ...
Cody Zeller | $3,500,000 | $0 | $3,500,000 | Feb 6, 2025 | ...
Clint Capela | $6,700,000 | $0 | $6,700,000 | Jul 6, 2025 | ...
```

**Analysis Notes:**
Active trade exceptions with dollar amounts, usage tracking, and expiration dates. Critical for understanding available trade flexibility.

---
#### Table 1: Contract Data

**Technical Details:**
- CSS Classes: `sw_table__default sw_table__fixed sw_table__stickyFirstColumn`
- Table ID: `sw_teamProfile__draftTable`  
- Size: 3 rows × 8 columns

**Headers:**
- Draft
- 2026
- 2027
- 2028
- 2029
- 2030
- 2031
- 2032

**Data Structure:**
```
Draft | 2026 | 2027 | 2028 | 2029 | ...
--- | --- | --- | --- | --- | ---
Round 1 |  |  |  |  | ...
Round 2 |  |  |  |  | ...
```

**Analysis Notes:**
Additional salary and contract information related to team cap management.

---
#### Table 2: Active Player Contracts

**Technical Details:**
- CSS Classes: `sw_teamProfileRosterSection__table sw_table__collapsiblePlayerColumn sw_table__default sw_table__fixed sw_table__stickyFirstColumn`
- Table ID: `none`  
- Size: 16 rows × 12 columns

**Headers:**
- Active (14 - $184,432,415)
- Status
- Acquired
- Age
- Pos
- Terms
- 2025-26
- 2026-27
- 2027-28
- 2028-29
- 2029-30
- 2030-31

**Data Structure:**
```
Active (14 - $184,432,415) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Young, Trae | Active List | Draft | 26 | PG | ...
Porzingis, Kristaps | Active List | Trade | 30 | PF | ...
Johnson, Jalen | Active List | Draft | 23 | PF, SF | ...
```

**Analysis Notes:**
Complete roster with multi-year salary projections through 2030-31, including guaranteed money and contract options.

---
#### Table 3: Training Camp & Exhibit 10 Players

**Technical Details:**
- CSS Classes: `sw_teamProfileRosterSection__table sw_table__collapsiblePlayerColumn sw_table__default sw_table__fixed sw_table__stickyFirstColumn`
- Table ID: `none`  
- Size: 4 rows × 12 columns

**Headers:**
- Training Camp and Exhibit 10 (2 - $0)
- Status
- Acquired
- Age
- Pos
- Terms
- 2025-26
- 2026-27
- 2027-28
- 2028-29
- 2029-30
- 2030-31

**Data Structure:**
```
Training Camp and Exhibit 10 (2 - $0) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Johnson, Kobe | Training Camp and Ex | Signed | 22 | PG, SG | ...
Houstan, Caleb | Training Camp and Ex | Signed | 22 | SF, SG | ...
TOTAL |  |  | 22.0 |  | ...
```

**Analysis Notes:**
Non-guaranteed players in training camp with contract details and potential roster spots.

---
#### Table 4: G-League & Minor League Players

**Technical Details:**
- CSS Classes: `sw_teamProfileRosterSection__table sw_table__collapsiblePlayerColumn sw_table__default sw_table__fixed sw_table__stickyFirstColumn`
- Table ID: `none`  
- Size: 6 rows × 12 columns

**Headers:**
- Minors/G-League (4 - $0)
- Status
- Acquired
- Age
- Pos
- Terms
- 2025-26
- 2026-27
- 2027-28
- 2028-29
- 2029-30
- 2030-31

**Data Structure:**
```
Minors/G-League (4 - $0) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Butler, Lamont | Minors/G-League | Signed | 23 | PG | ...
N'Diaye, Eli John | Minors/G-League | Signed | 21 | C | ...
Toppin, Jacob | Minors/G-League | Signed | 25 | SF | ...
```

**Analysis Notes:**
Affiliated players in development system with two-way and G-League contract details.

---
#### Table 5: Contract Data

**Technical Details:**
- CSS Classes: `sw_teamProfileStats__table sw_table__collapsiblePlayerColumn sw_table__fixed rel`
- Table ID: `none`  
- Size: 4 rows × 12 columns

**Headers:**
- 
- 
- 
- 
- 
- ROSTER SIZE
- 20
- 11
- 7
- 3
- 1
- -

**Data Structure:**
```
 |  |  |  |  | ...
--- | --- | --- | --- | --- | ---
 |  |  |  |  | ...
 |  |  |  |  | ...
 |  |  |  |  | ...
```

**Analysis Notes:**
Additional salary and contract information related to team cap management.

---
#### Table 6: Salary Cap Statistics

**Technical Details:**
- CSS Classes: `sw_teamProfileStats__table sw_table__collapsiblePlayerColumn sw_table__fixed rel`
- Table ID: `none`  
- Size: 9 rows × 12 columns

**Headers:**
- 
- 
- 
- 
- 
- ROSTER CAP HIT
- $184,432,415
- $143,256,969
- $88,568,302
- $51,962,703
- $30,000,000
- -

**Data Structure:**
```
 |  |  |  |  | ...
--- | --- | --- | --- | --- | ---
 |  |  |  |  | ...
 |  |  |  |  | ...
 |  |  |  |  | ...
```

**Analysis Notes:**
Team payroll, cap room, luxury tax projections, and multi-year salary cap planning data.

---
#### Table 7: Salary Cap Statistics

**Technical Details:**
- CSS Classes: `sw_teamProfileStats__table sw_table__collapsiblePlayerColumn sw_table__fixed rel`
- Table ID: `none`  
- Size: 12 rows × 12 columns

**Headers:**
- 
- 
- 
- 
- 
- CAP
- $154,647,000
- $165,472,000
- $182,019,000
- $200,221,000
- $220,243,000
- $242,267,000

**Data Structure:**
```
 |  |  |  |  | ...
--- | --- | --- | --- | --- | ---
 |  |  |  |  | ...

 |  |  |  |  | ...
```

**Analysis Notes:**
Team payroll, cap room, luxury tax projections, and multi-year salary cap planning data.

---
#### Table 8: Second Round Picks

**Technical Details:**
- CSS Classes: `sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn`
- Table ID: `none`  
- Size: 6 rows × 12 columns

**Headers:**
- 2nd Rd Picks (4 - $0)
- Status
- Acquired
- Age
- Pos
- Terms
- 2025-26
- 2026-27
- 2027-28
- 2028-29
- 2029-30
- 2030-31

**Data Structure:**
```
2nd Rd Picks (4 - $0) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Binelli, Augusto (40 | Hold |  | 60 | C | ...
Digbeu, Alain (49th  | Hold |  | 49 | SF | ...
Eriksson, Marcus (50 | Hold |  | 31 | PG | ...
```

**Analysis Notes:**
Draft picks and rookie contracts with team options and development timelines.

---
#### Table 9: Restricted Free Agents

**Technical Details:**
- CSS Classes: `sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn`
- Table ID: `none`  
- Size: 13 rows × 12 columns

**Headers:**
- RFAs (11 - $0)
- Status
- Acquired
- Age
- Pos
- Terms
- 2025-26
- 2026-27
- 2027-28
- 2028-29
- 2029-30
- 2030-31

**Data Structure:**
```
RFAs (11 - $0) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Daniels, Dyson | RFA |  | 22 | SG, SF | ...
Butler, Lamont | RFA |  | 23 | PG | ...
Johnson, Kobe | RFA |  | 22 | PG, SG | ...
```

**Analysis Notes:**
Players with restricted free agency status, qualifying offers, and cap hold amounts.

---
#### Table 10: Unrestricted Free Agents

**Technical Details:**
- CSS Classes: `sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn`
- Table ID: `none`  
- Size: 11 rows × 12 columns

**Headers:**
- UFAs (9 - $0)
- Status
- Acquired
- Age
- Pos
- Terms
- 2025-26
- 2026-27
- 2027-28
- 2028-29
- 2029-30
- 2030-31

**Data Structure:**
```
UFAs (9 - $0) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Porzingis, Kristaps | UFA |  | 30 | PF | ...
Kennard, Luke | UFA |  | 29 | SG | ...
Houstan, Caleb | UFA |  | 22 | SF, SG | ...
```

**Analysis Notes:**
Unrestricted free agents with cap holds and bird rights classifications.

---
#### Table 11: Free Agent Cap Holds

**Technical Details:**
- CSS Classes: `sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn`
- Table ID: `none`  
- Size: 6 rows × 12 columns

**Headers:**
- FA Cap Hold (4 - $8,937,316)
- Status
- Acquired
- Age
- Pos
- Terms
- 2025-26
- 2026-27
- 2027-28
- 2028-29
- 2029-30
- 2030-31

**Data Structure:**
```
FA Cap Hold (4 - $8,937,316) | Status | Acquired | Age | Pos | ...
--- | --- | --- | --- | --- | ---
Mathews, Garrison | FA Cap Hold |  | 28 | SG | ...
Matthews, Wesley | FA Cap Hold |  | 38 | SF, SG | ...
Forrest, Trent | FA Cap Hold |  | 27 | PG, SG | ...
```

**Analysis Notes:**
Cap holds for free agents with dollar amounts and bird rights status affecting salary cap.

---
#### Table 12: Contract Data

**Technical Details:**
- CSS Classes: ``
- Table ID: `legend`  
- Size: 1 rows × 2 columns

**Headers:**
- Legend
- IncentivesInjuredUnrestricted Free AgentRestricted Free AgentUnconfirmed Info38+Over 38 ContractRSCRookie Scale ContractNTCNo Trade Clause

**Data Structure:**
_No sample data available_

**Analysis Notes:**
Additional salary and contract information related to team cap management.

---

---

## 🚀 Data Extraction Value

**Why This Data is Valuable:**
1. **Complete Contract Tracking**: Every player's salary through 2030-31
2. **Exception Management**: TPE amounts, usage, and expiration dates
3. **Cap Planning**: Multi-year cap projections and luxury tax implications  
4. **Free Agency**: RFA/UFA status with cap holds and bird rights
5. **Roster Construction**: Training camp, G-League, and draft pick tracking

**Comparison to Spotrac:**
- ✅ **More Years**: Covers through 2030-31 vs Spotrac's 2025-29 limit
- ✅ **Trade Exceptions**: Detailed TPE tracking with expiration dates
- ✅ **Exception Data**: MLE, BAE, Room Exception amounts  
- ✅ **Comprehensive View**: All salary cap elements on single page
- ✅ **Efficiency**: 30 total requests (1 per team) vs 60+ with Spotrac

**Production Benefits:**
- Single request per team captures complete salary cap picture
- Multi-year contract projections enable long-term planning
- Trade exception tracking supports front office trade analysis
- Free agency data assists with roster construction planning

---

## 📋 Implementation Status

**Current Pipeline Status:**
- ✅ **Comprehensive Data Collection**: All page data captured and analyzed
- ✅ **Table Analysis**: 10 high-value tables identified  
- ✅ **Targeted Extractor**: Production-ready scraper generated for 10 priority tables
- ✅ **Data Validation**: Extraction logic tested and validated

**Next Steps:**
1. Deploy targeted extractor for all 30 teams
2. Integrate extracted data into existing salary cap database
3. Replace Spotrac pipeline with SalarySwish comprehensive approach

---

*Report generated on 9/6/2025, 1:15:47 PM*
*Data source: SalarySwish.com comprehensive page analysis*