# SalarySwish Migration Plan

## Overview

Transitioning from Spotrac to SalarySwish as the primary data source for NBA salary cap and contract information. SalarySwish provides all necessary data on a single page per team, making it more efficient than the current dual-endpoint Spotrac approach.

## Data Source Analysis

### SalarySwish Structure
- **Base URL**: `https://www.salaryswish.com/teams/{team-slug}`
- **Example**: `https://www.salaryswish.com/teams/hawks`
- **Benefits**:
  - All contract years on one page (current + future)
  - Exception data included 
  - Player options and incentives visible
  - Clean, consistent table structure
  - No rate limiting concerns (single request per team)

### Team URL Mapping
Need to establish mapping from NBA team names to SalarySwish URL slugs:

| Team | SalarySwish Slug | Current Spotrac ID |
|------|------------------|-------------------|
| Atlanta Hawks | hawks | atlanta-hawks |
| Boston Celtics | celtics | boston-celtics |
| Brooklyn Nets | nets | brooklyn-nets |
| Charlotte Hornets | hornets | charlotte-hornets |
| ... | ... | ... |

## Data Collection Strategy

### Phase 1: Investigation & Mapping
1. **URL Structure Discovery**: Test SalarySwish URLs for all 30 teams
2. **HTML Structure Analysis**: Parse sample team page to understand:
   - Table selectors and structure
   - Column organization (player, position, years, etc.)
   - Exception data location and format
   - Option/incentive indicators
3. **Data Format Documentation**: Map SalarySwish data to our existing schema

### Phase 2: Single Team Prototype
1. **Create Test Scraper**: `test_salaryswish_scraper.js`
   - Target Atlanta Hawks first (`/teams/hawks`)
   - Extract all available contract data
   - Parse exception information
   - Document data extraction patterns
2. **Data Structure Definition**: Define complete data schema for SalarySwish output
3. **Validation Logic**: Ensure extracted data matches expected format

### Phase 3: Full Implementation
1. **Update Main Scraper**: Modify `local_fresh_data_scraper.js`
   - Replace Spotrac endpoints with SalarySwish
   - Implement robust parsing for all 30 teams
   - Maintain existing progress logging format
2. **Schema Integration**: Ensure compatibility with existing:
   - `migrate_and_structure.js`
   - `load_to_firebase.js`
   - Frontend data consumption patterns

## Expected Data Structure

### SalarySwish Page Content (Anticipated)
Based on standard salary cap sites, expecting:

```javascript
{
  teamData: {
    name: "Atlanta Hawks",
    payrollSummary: {
      currentYear: "2024-25",
      totalPayroll: 168500000,
      luxuryTax: 15200000,
      capSpace: 0
    }
  },
  players: [
    {
      name: "Trae Young",
      position: "PG", 
      contracts: {
        "2024-25": { salary: 40064220, guaranteed: true },
        "2025-26": { salary: 43279250, guaranteed: true },
        "2026-27": { salary: 46794270, guaranteed: true },
        "2027-28": { salary: 50309290, teamOption: true }
      }
    }
  ],
  exceptions: {
    freeAgent: [
      { type: "Mid-Level Exception", amount: 12400000, expires: "2025-07-01" }
    ],
    tradedPlayer: [
      { origin: "John Collins Trade", amount: 8200000, expires: "2025-01-15" }
    ]
  },
  capDetails: {
    hardCapStatus: false,
    apronStatus: "below",
    projectedTax: 15200000
  }
}
```

## Implementation Benefits

### Efficiency Improvements
- **30 requests total** (vs current 60 with Spotrac dual-endpoint)
- **Single page per team** contains all needed data
- **No rate limiting delays** needed between requests
- **Simpler parsing logic** with consistent structure

### Data Completeness
- **Multi-year contracts**: All future years on one page
- **Exception data**: Free agent and traded player exceptions
- **Contract details**: Options, incentives, trade restrictions  
- **Cap calculations**: Real-time luxury tax and apron status

### Maintenance Benefits
- **Single endpoint** per team reduces complexity
- **Consistent structure** across all teams
- **Less brittle parsing** with unified table format

## Migration Steps

1. **Create team slug mapping** (30 team URLs)
2. **Build test scraper** for single team validation
3. **Document data extraction patterns** from sample page
4. **Update main scraper** with SalarySwish logic
5. **Test full 30-team pipeline** locally
6. **Validate data integration** with existing Firebase schema
7. **Update documentation** and pipeline scripts

## Risk Assessment

### Potential Challenges
- **URL slug discovery**: Need to identify correct team slugs
- **Data format variations**: Teams may have different table structures
- **Missing data handling**: Graceful fallbacks for incomplete information
- **Rate limiting**: Unknown if SalarySwish has restrictions

### Mitigation Strategies
- **Start with single team** for thorough testing
- **Robust error handling** with clear logging
- **Flexible parsing** that handles structural variations
- **Fallback data sources** if certain information missing

## Timeline

- **Day 1**: Team URL mapping and single team prototype
- **Day 2**: Data structure analysis and extraction logic
- **Day 3**: Full scraper implementation and testing
- **Day 4**: Integration with existing pipeline and validation

## Success Criteria

1. **Complete data extraction** for all 30 teams
2. **Multi-year contract data** (2024-25 through 2028-29+)
3. **Exception information** properly captured
4. **Schema compatibility** with existing Firebase collections
5. **Improved efficiency** (30 vs 60+ requests)
6. **Clear progress reporting** during scraping process

This approach leverages SalarySwish's comprehensive single-page data structure to simplify our scraping architecture while ensuring complete data collection for salary cap management tools.