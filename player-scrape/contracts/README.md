# Contract Scraping Module

This module handles scraping NBA player contract data from SalarySwish.

## Status

✅ **Production Ready** - All contract normalization features are implemented and tested.

## Scripts

All contract-related scripts are located in `contracts/scripts/`:

- **`parse_player.ts`** - Parse contract data from HTML pages
- **`fetch_player_page.ts`** - Fetch player pages from SalarySwish
- **`batch_scrape_players.ts`** - Process multiple players in batch
- **`validate_player.ts`** - Validate parsed data against schema
- **`test_contract_normalization.ts`** - Test suite for contract normalization
- **`validate_po_voiding.ts`** - Validate player option voiding logic
- **Batch processing scripts** - Various team-specific batch processors

## Usage

See the main [README.md](../README.md) for usage examples.

## Features

- ✅ Comprehensive contract data extraction
- ✅ Guarantee schedules and partial guarantees
- ✅ Option tracking (PO, TO, ETO)
- ✅ Extension voiding logic
- ✅ Bird rights and free agency data
- ✅ Trade eligibility rules
- ✅ CBA-compliant contract types
