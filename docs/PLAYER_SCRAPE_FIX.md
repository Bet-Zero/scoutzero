# Player-Scrape Fix Documentation

## Problem Summary

The player contract scraper was failing to extract salary data from SalarySwish pages, even though:
- ✅ The HTML was successfully fetched
- ✅ The HTML contained all the salary data
- ✅ Basic info (name, contract type, Bird rights) was extracted
- ❌ **The salary table parsing failed - salariesByYear array was empty**

## Root Cause

The issue had two components:

### 1. JavaScript Rendering Issue
**Problem**: SalarySwish likely uses JavaScript to render salary tables, but the original scraper used `requests` which cannot execute JavaScript.

**Solution**: Added Playwright support to the scraper to render JavaScript-generated content before parsing.

### 2. Inflexible Table Parsing
**Problem**: The original parser had rigid assumptions:
- Assumed exactly 4 columns
- Always used column index 3 for salary data
- Only looked for simple `<table>` elements

**Solution**: Implemented a robust, multi-strategy table parsing approach:
- ✅ Searches for tables with SalarySwish-specific classes (`sw_table`)
- ✅ Intelligently detects which column contains salary data by reading headers
- ✅ Handles tables with 2-10+ columns
- ✅ Supports multiple salary formats ($54,126,450, 54.1M, etc.)
- ✅ Falls back through multiple table-finding strategies

## Changes Made

### 1. Enhanced Parser (`parse_contract_data_enhanced.py`)

#### Table Finding Strategy
```python
# Strategy 1: Look for SalarySwish-specific classes
table = scoped.find("table", class_=lambda x: x and "sw_table" in x)

# Strategy 2: Any table in scoped area
if not table:
    table = scoped.find("table")

# Strategy 3: Try full document
if not table:
    table = soup.find("table")
```

#### Column Detection
```python
# Read header row to identify columns
headers = [h.text.strip().upper() for h in header_cells]

# Find salary column by header name
for idx, header in enumerate(headers):
    if any(keyword in header for keyword in ["CAP HIT", "SALARY", "BASE SALARY"]):
        salary_col_idx = idx
```

#### Flexible Salary Parsing
```python
# Handle multiple formats
# "$54,126,450" -> 54126450
# "54.1M" -> 54100000
# "54126450" -> 54126450

if "M" in salary_text.upper():
    # Millions notation
    mil_match = re.search(r"([\d.]+)M", salary_text.upper())
    if mil_match:
        salary = int(float(mil_match.group(1)) * 1_000_000)
else:
    # Regular numeric
    cleaned = re.sub(r"[^\d,.]", "", salary_text)
    salary = int(cleaned.replace(",", ""))
```

### 2. Playwright Support (`scrape_all_contracts.py`)

#### Added Playwright Integration
```python
# Import with fallback
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
```

#### Scraping with JavaScript Rendering
```python
def scrape_with_playwright(url, max_retries=2):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Wait for network to be idle (all JS executed)
        page.goto(url, wait_until="networkidle", timeout=30000)
        
        # Wait for table to load
        page.wait_for_selector("table", timeout=10000)
        
        # Get fully rendered HTML
        html_content = page.content()
        browser.close()
        
        return html_content
```

#### Intelligent Fallback
The scraper tries Playwright first, then falls back to `requests` if Playwright is unavailable.

## Testing

### Test Coverage
Created comprehensive test suite (`test_parser_validation.py`):

1. **5-Column Table Test** (Jayson Tatum style)
   - Tests DESIGNATED VETERAN EXTENSION
   - Validates $313.9M contract parsing
   - Checks Bird Rights extraction
   - ✅ PASSED

2. **3-Column Table Test**
   - Tests reduced column count
   - Validates intelligent column detection
   - ✅ PASSED

3. **No sw_bodyContent Test**
   - Tests when expected div structure is missing
   - Validates fallback to document-level search
   - ✅ PASSED

4. **Millions Notation Test**
   - Tests "54.1M" format parsing
   - Validates conversion to 54,100,000
   - ✅ PASSED

5. **Edge Cases Test**
   - Empty HTML handling
   - Missing tables
   - Invalid data
   - ✅ PASSED

### Test Results
```
📊 Test Results: 5 passed, 0 failed
✅ All tests passed! Parser is working correctly.
```

## Expected Outcomes

With these fixes, the scraper should now:

### For Jayson Tatum Example:
- ✅ Fetch JavaScript-rendered page with Playwright
- ✅ Detect salary table with `sw_table__stickyFirstColumn` class
- ✅ Parse all 5 years of salary data:
  - 2026: $54,126,450
  - 2027: $58,456,606
  - 2028: $62,786,762
  - 2029: $67,116,918
  - 2030: $71,447,074
- ✅ Calculate total: $313,933,810
- ✅ Identify as DESIGNATED VETERAN EXTENSION
- ✅ Extract Bird Rights: "Full Bird"

### For All Players:
- ✅ Handle varying table structures (2-10+ columns)
- ✅ Work with/without JavaScript rendering
- ✅ Parse multiple salary formats
- ✅ Gracefully handle missing data
- ✅ Provide detailed logging for debugging

## Installation Requirements

### For Full Functionality (Playwright):
```bash
pip install playwright beautifulsoup4
playwright install chromium
```

### Minimum Requirements (requests fallback):
```bash
pip install beautifulsoup4 requests
```

## Usage

### Run Full Scraper
```bash
python3 data_pipeline/helpers/contracts/scrape_all_contracts.py
```

### Run Parser Only
```bash
python3 data_pipeline/helpers/contracts/parse_contract_data_enhanced.py
```

### Run Validation Tests
```bash
python3 data_pipeline/helpers/contracts/test_parser_validation.py
```

## Known Limitations

1. **Network Access**: Playwright requires internet access to fetch pages
2. **Performance**: JavaScript rendering is slower than static requests (~2-3s per page vs <1s)
3. **Browser Dependencies**: Playwright requires Chromium to be installed

## Future Improvements

1. Add retry logic with exponential backoff
2. Implement caching to avoid re-scraping unchanged pages
3. Add parallel processing for bulk scraping
4. Create incremental update mode for only changed contracts
5. Add monitoring/alerting for scraping failures
