# Changelog

All notable changes to the player-scrape system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
