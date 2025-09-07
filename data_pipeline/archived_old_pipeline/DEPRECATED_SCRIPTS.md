# Deprecated Scripts - Team-Based Approach Only

The data pipeline has been consolidated to use **TEAM-BASED SCRAPING** exclusively for consistency.

## Active Script (Use This One)

- `local_fresh_data_scraper.js` - **PRIMARY** team-based scraper

## Deprecated Scripts (Do Not Use)

The following scripts are deprecated to avoid confusion:

- `real_fresh_data_scraper.js` - Duplicate functionality, causes inconsistency
- `complete_fresh_pipeline.js` - Overly complex, use main pipeline instead
- `scrape_fresh_nba_data.js` - Old approach, superseded by team-based method

## Why Team-Based Only?

- **Efficient**: 30 team requests instead of 450+ individual players
- **Respectful**: Lower server load on external APIs
- **Consistent**: Single approach eliminates confusion
- **Maintainable**: One script to update and debug

## The Team-Based Approach

1. Scrape each NBA team's Spotrac payroll page
2. Extract all player contracts from that team page
3. Rate limited (3 seconds between teams)
4. Total: 30 requests for all NBA player contracts

This gives us 100% contract coverage with 93% fewer requests than individual player scraping.
