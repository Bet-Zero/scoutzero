# Contract Scraping System

This directory contains the contract scraping and parsing system for SalarySwish data.

## Overview

The system consists of three main components:

1. **Scraper** (`scrape_all_contracts.py`) - Fetches contract pages from SalarySwish
2. **Parser** (`parse_contract_data_enhanced.py`) - Extracts structured data from HTML
3. **Tests** - Validation and testing scripts

## Recent Fixes (Player-Scrape Fix)

The scraper was recently fixed to address issues where salary table data wasn't being extracted:

- ✅ Added Playwright support for JavaScript-rendered content
- ✅ Enhanced parser to handle various table structures (2-10+ columns)
- ✅ Intelligent column detection based on headers
- ✅ Multiple salary format support ($54,126,450, 54.1M, etc.)
- ✅ Robust fallback strategies

See [PLAYER_SCRAPE_FIX.md](../../../docs/PLAYER_SCRAPE_FIX.md) for detailed documentation.

## Installation

### Full Installation (Recommended)
```bash
pip install playwright beautifulsoup4 requests
playwright install chromium
```

### Minimal Installation (Fallback mode)
```bash
pip install beautifulsoup4 requests
```

## Usage

### Test Single Player
Quick test to validate scraping and parsing:

```bash
# Test with Jayson Tatum
python3 test_single_player.py jayson-tatum

# Test with another player
python3 test_single_player.py stephen-curry
```

### Run Full Scraper
Scrape all players in the database:

```bash
python3 scrape_all_contracts.py
```

Output: `../../resources/data/raw_contract_html.json`

### Run Parser
Parse scraped HTML into structured data:

```bash
python3 parse_contract_data_enhanced.py
```

Input: `../../resources/data/raw_contract_html.json`
Output: `../../resources/data/contracts_parsed.json`

### Run Validation Tests
Test the parser with various table structures:

```bash
python3 test_parser_validation.py
```

Expected output:
```
📊 Test Results: 5 passed, 0 failed
✅ All tests passed! Parser is working correctly.
```

## File Structure

```
helpers/contracts/
├── scrape_all_contracts.py          # Main scraper (Playwright + requests)
├── parse_contract_data_enhanced.py  # HTML parser with enhanced table logic
├── test_single_player.py            # Test single player scraping
├── test_parser_validation.py        # Comprehensive parser tests
└── README.md                        # This file
```

## How It Works

### 1. Scraping
```python
# With Playwright (JavaScript rendering)
page.goto(url, wait_until="networkidle")
page.wait_for_selector("table")
html = page.content()

# Fallback to requests if needed
response = requests.get(url)
html = response.text
```

### 2. Parsing
```python
# Find table with multiple strategies
table = scoped.find("table", class_=lambda x: "sw_table" in x)
if not table:
    table = scoped.find("table")

# Detect salary column from headers
headers = [h.text.upper() for h in header_row.find_all("th")]
salary_col_idx = find_column_by_keyword(headers, ["CAP HIT", "SALARY"])

# Parse each row
for row in data_rows:
    year = extract_year(row.cells[0].text)  # "2025-26" -> 2026
    salary = extract_salary(row.cells[salary_col_idx].text)  # "$54.1M" -> 54100000
```

### 3. Data Structure
Output format:
```json
{
  "player_id": "jayson_tatum",
  "name": "Jayson Tatum",
  "bird_rights": "Full Bird",
  "contract_summary": {
    "type": "DESIGNATED VETERAN EXTENSION",
    "length": "5 years",
    "value": 313933810,
    "aav": 62786762,
    "is_extension": true
  },
  "contract": {
    "annual_salaries": [
      {"year": 2026, "salary": 54126450},
      {"year": 2027, "salary": 58456606},
      ...
    ],
    "extension": { ... }
  }
}
```

## Troubleshooting

### Issue: "Playwright not available"
**Solution**: Install Playwright:
```bash
pip install playwright
playwright install chromium
```

### Issue: "No salary data extracted"
**Possible causes**:
1. Site structure changed - check HTML manually
2. JavaScript not rendering - ensure Playwright is installed
3. Network issues - verify site is accessible

**Debug steps**:
```bash
# Test with single player to see detailed output
python3 test_single_player.py jayson-tatum

# Check saved HTML
cat /tmp/jayson-tatum_parsed.json
```

### Issue: "Browser installation failed"
**Solution**: The Playwright browser installation may fail in some environments. Use the fallback:
```python
# The scraper automatically falls back to requests if Playwright fails
# Output will show: "⚠️ Playwright not available - using requests"
```

## Testing

### Unit Tests
```bash
python3 test_parser_validation.py
```

Tests:
- 5-column table (Jayson Tatum style)
- 3-column table
- No sw_bodyContent div
- Millions notation (54.1M)
- Edge cases

### Integration Test
```bash
python3 test_single_player.py jayson-tatum
```

Expected output:
```
✅ SUCCESS: Parser extracted salary data correctly!
```

## Performance

- **Playwright**: ~2-3 seconds per page (JavaScript rendering)
- **Requests**: <1 second per page (static HTML only)
- **Full scrape** (450 players): ~15-20 minutes with Playwright

## Known Limitations

1. Requires internet access to SalarySwish
2. JavaScript rendering needs Playwright (larger dependency)
3. Rate limiting may require delays between requests
4. Site structure changes may break parser

## Future Enhancements

- [ ] Add caching to avoid re-scraping unchanged pages
- [ ] Implement parallel processing for bulk scraping
- [ ] Add incremental update mode
- [ ] Create monitoring/alerting for failures
- [ ] Add rate limiting with exponential backoff
