# Changelog

All notable changes to the player-scrape system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **DisplayName formatting fix (Dec 2025)**: Player names now use proper capitalization from NBA API
  - Bio scraper extracts `displayName` from NBA API's `DISPLAY_FIRST_LAST` field
  - Staging script prioritizes bio `displayName` over contract `displayName` for both `players_v2` and `architect_basePlayers`
  - Examples: "LeBron James" instead of "LEBRON JAMES", "CJ McCollum" instead of "CJ MCCOLLUM"
- **Stats integration fix (Dec 2025)**: Corrected stats path configuration in staging script
  - Fixed `STATS_DIR` path from `stats/_artifacts/output` to `stats/output`
  - Season statistics now properly included in staged player documents
- **Directory reorganization (Dec 2025)**: Moved staging output to cleaner location
  - Moved `firestore_staging/scripts/_artifacts/` to `firestore_staging/_artifacts/`
  - Updated all path references in staging and push scripts
  - Final staged files now in `firestore_staging/_artifacts/output/`

### Changed

- **Bio data integration**: Modified `buildPlayersV2Payload` to use NBA API displayName as authoritative source
- **Staging script paths**: Updated default output directory references across all scripts
- **Documentation updates**: Updated all README files and PROJECT_SCHEMA.md to reflect new paths

### Added (Previous)

- **Documentation reorganization**: Created STATUS.md with accurate production-ready status
- **Documentation index**: Added docs/INDEX.md for better navigation
- **PO voided by extension handling**: Parser now detects when a future extension voids a player option (PO) in the prior contract
  - Marks voided PO years with `voidedByExtension: true`, `guaranteed: false`, `guaranteedAmount: 0`
  - Adds `optionUsed` field to track when option was declined (e.g., "No (2025-08-02)")
  - Adds `voidedOn` field with ISO date of voiding
  - Adds `supersededIn` and `supersededByContractRef` to prior contract metadata
  - Recomputes `guaranteedValue`, `guaranteedYears`, and `yearsRemaining` excluding voided seasons
- **Max contract normalization**: Improved max contract detection and labeling
  - Reads `Cap %` directly from SalarySwish page when available
  - Uses new taxonomy: `"Max-25"`, `"Max-30"`, `"Max-35"` instead of generic "Supermax"/"Veteran Max"
  - Adds `isMaxContract`, `maxType`, and `estimatedCapPercentage` fields to contract schema
- **Utility function**: `parseOptionUsedDate()` for extracting dates from "Option Used: No (Aug 2, 2025)" format

### Changed

- **Documentation structure**: Reorganized root-level docs, moved technical details to docs/ subfolder
- **README simplification**: Updated main README to reflect production-ready status
- **Schema updates**:
  - `SalaryYearSchema` now includes `optionUsed`, `voidedByExtension`, and `voidedOn` fields
  - `ContractSchema` now includes `isMaxContract`, `maxType`, `estimatedCapPercentage`, `supersededIn`, and `supersededByContractRef` fields
- **Max contract detection**: `detectMaxContractInfo()` now takes cheerio instance and table parameter for better cap% extraction

### Removed

- **Outdated documentation**: Removed 5 outdated docs claiming "85-90% ready" status (READINESS_ASSESSMENT.md, QUICK_SUMMARY.md, PATH_TO_100.md, GETTING_STARTED.md)
- **Duplicate completion summaries**: Consolidated multiple completion/implementation summary documents

### Fixed

- Guaranteed totals now correctly exclude voided player options when extension supersedes prior contract
- Documentation links updated to reflect new structure

## [1.0.0] - 2025-10-23

### Added

- Initial release with multi-contract support
- Comprehensive contract parsing from SalarySwish
- Bio information extraction
- Bird rights and free agency tracking
- Trade eligibility detection
- Future contract/extension detection

[Unreleased]: https://github.com/Bet-Zero/scoutzero/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Bet-Zero/scoutzero/releases/tag/v1.0.0
