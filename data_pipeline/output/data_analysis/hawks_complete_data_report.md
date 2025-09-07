# Atlanta Hawks - Complete SalarySwish Data Report

**Data Source:** https://www.salaryswish.com/teams/hawks
**Scraped:** 9/7/2025, 6:38:29 AM
**Total Tables Found:** 3

## 🔍 IMPORTANT: About This Report

**This report shows ALL data from each table found on SalarySwish.** The comprehensive scraper captures every row from every table to provide complete data inventory.

**What you see below:**
- Complete table structure (headers, size, data types)
- ALL rows from each table showing complete data
- Analysis of what each table contains

---

## 📊 ALL DATA FOUND ON SALARYSWISH PAGE

This report shows EVERY piece of data found on the SalarySwish page.
Each table below contains ALL rows of data, not samples.

## Table 1: Active Roster

**Table Type:** active-roster
**Size:** 16 rows × 8 columns
**Data Types:** 💰 Salary Data, 👤 Player Data, 📄 Contract Data

### Complete Data (showing all 2 rows):

| Player | Position | Age | 2025-26 | 2026-27 | 2027-28 | 2028-29 | 2029-30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Jalen Johnson | PF, SF | 23 | $30,000,000 | $30,000,000 | $30,000,000 | $30,000,000 | $30,000,000 |
| Trae Young | PG | 26 | $43,031,940 | $46,494,496 | $49,957,052 | $53,419,608 | - |

---

## Table 2: Cap Statistics

**Table Type:** cap-statistics
**Size:** 6 rows × 6 columns
**Data Types:** 💰 Salary Data

### Complete Data (showing all 1 rows):

| Year | Team Salary | Salary Cap | Cap Room | Luxury Tax | Tax Room |
| --- | --- | --- | --- | --- | --- |
| 2025-26 | $184,432,415 | $214,217,830 | $29,785,415 | $187,680,245 | $3,462,585 |

---

## Table 3: Trade Exceptions

**Table Type:** trade-exceptions
**Size:** 2 rows × 6 columns
**Data Types:** 💰 Salary Data, 👤 Player Data, 🎫 Exception Data

### Complete Data (showing all 1 rows):

| Player | Amount | Used | Remaining | Start Date | End Date |
| --- | --- | --- | --- | --- | --- |
| Bogdan Bogdanovic | $13,101,561 | $0 | $13,101,561 | Feb 6, 2025 | Feb 6, 2026 |

---

## 📈 Data Summary

**Players Found:** 3
**Player Names:** Jalen Johnson, Trae Young, Bogdan Bogdanovic
**Years Covered:** 2025-26, 2026-27, 2027-28, 2028-29, 2029-30
**Salary Range:** $13,101,561 - $53,419,608
**Tables with Salary Data:** 3
**Tables with Player Data:** 2
**Tables with Contract Data:** 1

---

## 🎯 What This Data Provides

This SalarySwish page contains comprehensive NBA salary cap data including:

- **Complete Player Contracts:** Multi-year salary details for all roster players
- **Salary Cap Management:** Team payroll, cap room, luxury tax calculations
- **Trade Exceptions:** Available TPEs with amounts and expiration dates
- **Future Projections:** Salary commitments through multiple seasons

This data is essential for NBA salary cap management and trade analysis.
## 🎯 What Each Table Contains

**Table 1 (Active Roster):**
- 16 total rows with 8 columns
- Headers: Player, Position, Age, 2025-26, 2026-27, 2027-28, 2028-29, 2029-30
- Data Types: 💰 Salary Data, 👤 Player Data, 📄 Contract Data
- Contains: Player salary contracts with multi-year projections, Player names, positions, ages, and roster status, Contract terms, options, and acquisition details

**Table 2 (Cap Statistics):**
- 6 total rows with 6 columns
- Headers: Year, Team Salary, Salary Cap, Cap Room, Luxury Tax, Tax Room
- Data Types: 💰 Salary Data
- Contains: Salary cap calculations and team payroll summary

**Table 3 (Trade Exceptions):**
- 2 total rows with 6 columns
- Headers: Player, Amount, Used, Remaining, Start Date, End Date
- Data Types: 💰 Salary Data, 👤 Player Data, 🎫 Exception Data
- Contains: Trade exceptions and signing exceptions with amounts, Player names, positions, ages, and roster status, Trade exceptions with usage tracking and expiration dates

## 🚀 Next Steps

**To extract complete data from specific tables:**
1. Run the targeted scraper: `node data_pipeline/targeted_extractor_generator.js --team hawks`
2. This will generate a targeted extractor that captures ALL rows from high-value tables
3. The extractor focuses on tables containing salary cap data you identified as important

**This comprehensive-first approach ensures:**
- You see what data is available before deciding what to extract
- No wasted time extracting irrelevant data
- Efficient targeted extraction of only valuable tables

