# Comprehensive SalarySwish Data Pipeline - Complete Workflow Guide

## 🎯 Overview

This pipeline implements the **correct methodology** for extracting salary cap data from SalarySwish:

1. **Scrape EVERYTHING first** - no assumptions, no guesswork
2. **Analyze all data found** - see what's available and valuable  
3. **Decide what to extract** - make informed choices based on analysis
4. **Generate targeted extractor** - build production scraper for exactly what you want
5. **Extract final data** - get clean, structured salary cap data

## 🔄 The Complete Workflow

### Step 1: Comprehensive Data Discovery
**Purpose:** Scrape the entire SalarySwish page to see EVERYTHING available

```bash
# Scrape single team (recommended for initial discovery)
node comprehensive_salaryswish_scraper.js --team hawks

# Scrape multiple teams for comparison
node comprehensive_salaryswish_scraper.js --teams hawks,celtics,warriors

# Scrape all 30 teams (takes ~15 minutes)
node comprehensive_salaryswish_scraper.js --all
```

**What happens:**
- Fetches complete HTML from SalarySwish team page
- Extracts ALL tables, sections, headings, lists
- Identifies salary, contract, cap, exception, and draft elements
- Saves raw comprehensive data to `output/comprehensive_data/`
- **NO assumptions** about what's valuable - captures everything

### Step 2: Comprehensive Data Analysis  
**Purpose:** Analyze all scraped data to understand what's valuable

```bash
# Analyze single team's comprehensive data
node comprehensive_data_analyzer.js --team hawks

# Analyze all teams with comprehensive data
node comprehensive_data_analyzer.js --summary
```

**What happens:**
- Reads comprehensive data from Step 1
- Scores each table by value (salary data, contract info, multi-year data, etc.)
- Categorizes tables as HIGH/MEDIUM/LOW value
- Creates detailed analysis reports showing exactly what's available
- Generates extraction recommendations based on data analysis
- Creates human-readable reports in `output/data_analysis/`

**Key outputs:**
- `{team}_data_analysis.json` - Complete analysis data
- `{team}_readable_report.md` - Human-readable analysis report  
- Shows exactly which tables contain valuable salary cap data

### Step 3: Targeted Extractor Generation
**Purpose:** Generate production extractor for exactly what you want

```bash
# Interactive mode (recommended) - walk through options
node targeted_extractor_generator.js --interactive

# Auto mode - use high-value recommendations
node targeted_extractor_generator.js --team hawks --auto

# Manual mode - specify exact tables
node targeted_extractor_generator.js --team hawks --tables 0,2,3,8
```

**What happens:**
- Reads analysis results from Step 2
- Shows you high-value vs medium-value vs low-value tables
- Lets you choose exactly which tables to extract  
- Generates custom production scraper code
- Creates configuration files and test scripts
- Saves targeted extractor to `output/extractors/`

### Step 4: Test Targeted Extraction
**Purpose:** Validate the generated extractor works correctly

```bash
# Run the test for your generated extractor
node output/extractors/test_hawks_extractor.js
```

**What happens:**
- Tests the generated targeted extractor
- Shows sample data from each extracted table
- Validates data structure and content  
- Saves test results for review

### Step 5: Production Data Extraction  
**Purpose:** Extract final clean data for all teams

```bash
# Run targeted extractor for single team
node output/extractors/targeted_hawks_extractor.js

# Scale to all teams (modify extractor as needed)
# The extractor can be modified to process multiple teams
```

## 📊 What Data Gets Extracted

Based on comprehensive analysis of SalarySwish pages, you'll typically find:

### High-Value Tables (MUST EXTRACT):
1. **Multi-Year Player Contracts** - Complete salary data through 2030-31
2. **Trade Exceptions** - TPE amounts, usage, expiration dates  
3. **Active Roster** - Current player contracts with options/guarantees
4. **Free Agent Tracking** - RFA/UFA status with cap holds
5. **Draft Picks** - Future pick obligations and protections

### Medium-Value Tables (SHOULD EXTRACT):
6. **Salary Cap Summary** - Total payroll, cap room, luxury tax status
7. **Signing Exceptions** - MLE, BAE amounts and availability  
8. **Two-Way Contracts** - G-League player tracking

### Extracted Data Structure:
```json
{
  "metadata": {
    "team": "Atlanta Hawks",
    "extractedAt": "2024-01-15T10:30:00.000Z",
    "tablesExtracted": 5
  },
  "extractedData": {
    "table_0": {
      "config": { "headers": [...], "dataTypes": {...} },
      "data": [
        {
          "Player": { "text": "Trae Young", "type": "player", "cleanName": "Trae Young" },
          "2024-25": { 
            "text": "$43,031,940",
            "salaries": [{"text": "$43,031,940", "amount": 43031940}],
            "year": "2024-25",
            "type": "yearly_data"
          },
          "2025-26": { "text": "$46,674,495", ... },
          // ... more years
        }
        // ... more players
      ]
    },
    "table_2": {
      // Trade exceptions table data
    }
    // ... more tables
  }
}
```

## 🎛️ Configuration Options

### Comprehensive Scraper Options:
- `--team {slug}` - Single team  
- `--teams {slug1,slug2,slug3}` - Multiple teams
- `--all` - All 30 teams

### Analyzer Options:
- `--team {slug}` - Analyze single team
- `--summary` - Analyze all available team data

### Extractor Generator Options:
- `--interactive` - Walk through options interactively
- `--team {slug} --auto` - Use high-value recommendations
- `--team {slug} --tables {indices}` - Specify exact tables

## 📁 File Structure

```
data_pipeline/
├── comprehensive_salaryswish_scraper.js    # Step 1: Scrape everything
├── comprehensive_data_analyzer.js          # Step 2: Analyze data
├── targeted_extractor_generator.js         # Step 3: Generate extractor
├── output/
│   ├── comprehensive_data/                 # Raw scraped data
│   │   └── hawks_comprehensive_data.json
│   ├── data_analysis/                      # Analysis results
│   │   ├── hawks_data_analysis.json
│   │   └── hawks_readable_report.md
│   └── extractors/                         # Generated extractors
│       ├── targeted_hawks_extractor.js
│       ├── hawks_extraction_config.json
│       └── test_hawks_extractor.js
```

## 🚀 Getting Started

### Quick Start (Hawks Example):
```bash
# 1. Scrape all Hawks data
node comprehensive_salaryswish_scraper.js --team hawks

# 2. Analyze what was found  
node comprehensive_data_analyzer.js --team hawks

# 3. Review the analysis report
cat output/data_analysis/hawks_readable_report.md

# 4. Generate targeted extractor (interactive mode)
node targeted_extractor_generator.js --interactive

# 5. Test the extractor
node output/extractors/test_hawks_extractor.js
```

### Production Scale (All Teams):
```bash
# 1. Scrape all teams (takes ~15 minutes)
node comprehensive_salaryswish_scraper.js --all

# 2. Analyze summary across all teams
node comprehensive_data_analyzer.js --summary

# 3. Generate extractors for high-value teams
node targeted_extractor_generator.js --team hawks --auto
node targeted_extractor_generator.js --team celtics --auto  
node targeted_extractor_generator.js --team warriors --auto

# 4. Modify extractors to process all teams at scale
```

## ✅ Key Benefits of This Approach

1. **No Guesswork** - See everything available before deciding what to extract
2. **Data-Driven Decisions** - Choose extraction targets based on comprehensive analysis  
3. **Surgical Precision** - Extract exactly what you need, skip what you don't
4. **Production Ready** - Generated extractors are clean, documented, and testable
5. **Scalable** - Easy to modify for all 30 teams once you validate approach
6. **Future-Proof** - Comprehensive analysis documents complete data structure

## 🔧 Customization

### Adding New Data Types:
1. Modify `comprehensive_salaryswish_scraper.js` detection methods
2. Update analysis scoring in `comprehensive_data_analyzer.js`
3. Regenerate extractors with new data type support

### Changing Extraction Logic:
1. Review analysis results to understand data structure
2. Modify generated extractor's `processCellData()` method
3. Update extraction rules in configuration files

### Scaling to Multiple Teams:
1. Generate extractor for one team first
2. Test and validate data structure  
3. Modify extractor to accept team parameter
4. Create batch processing script for all 30 teams

## 🎯 Final Output

The final production data will be comprehensive salary cap information including:
- **Complete player contracts** with multi-year salaries, options, guarantees
- **Trade exception tracking** with amounts, usage, expiration dates
- **Free agent cap holds** with bird rights classifications
- **Draft pick obligations** through 2032 with protections
- **Salary cap statistics** including apron status and luxury tax
- **Signing exceptions** with MLE, BAE amounts and availability

This provides everything needed for complete NBA salary cap management and trade analysis.

---

*This approach ensures you capture ALL available SalarySwish data before making extraction decisions, eliminating guesswork and maximizing data value.*