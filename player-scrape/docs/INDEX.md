# Player-Scrape Documentation Index

This directory contains detailed technical documentation for the player-scrape system.

## Main Documentation

### [README.md](./README.md)
Complete technical documentation covering:
- System overview and architecture
- File structure and organization
- Script usage and examples
- Schema definitions
- Prerequisites and setup

### [SETUP_GUIDE.md](./SETUP_GUIDE.md)
Installation and setup instructions:
- Playwright browser installation
- Dependencies setup
- Environment configuration
- Troubleshooting common issues

## Implementation Documentation

### [NORMALIZATION_IMPLEMENTATION.md](./NORMALIZATION_IMPLEMENTATION.md)
Detailed contract normalization specification implementation:
- Contract type classification logic
- Guarantee tracking and schedules
- Option tracking (PO, TO, ETO)
- Extension voiding (Luka Rule)
- Max contract normalization
- Signing method normalization

### [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
Future contract/extension parsing implementation:
- Multi-contract detection
- Independent metadata parsing per contract
- Heading-based contract type detection
- Historical context and problem solved

## Feature-Specific Documentation

### [CONTRACT_CLEANUP_IMPLEMENTATION.md](./CONTRACT_CLEANUP_IMPLEMENTATION.md)
Contract cleanup and normalization enhancements

### [PO_VOIDING_FEATURE.md](./PO_VOIDING_FEATURE.md)
Player option voiding feature implementation details

### [MULTIPLE_CONTRACTS_PLAN.md](./MULTIPLE_CONTRACTS_PLAN.md)
Multiple contract parsing architecture and design

## Historical Documentation

### [ISSUE_299_FIX.md](./ISSUE_299_FIX.md)
Fix for Issue #299 - Independent metadata parsing for future contracts

### [JALEN_WILSON_INVESTIGATION.md](./JALEN_WILSON_INVESTIGATION.md)
Investigation and fix for Jalen Wilson contract parsing edge case

## Quick Navigation

**Just getting started?**
1. Read [../README.md](../README.md) (project root)
2. Check [../STATUS.md](../STATUS.md) (current status)
3. Follow [SETUP_GUIDE.md](./SETUP_GUIDE.md) (installation)

**Understanding the implementation?**
1. [README.md](./README.md) - Full technical overview
2. [NORMALIZATION_IMPLEMENTATION.md](./NORMALIZATION_IMPLEMENTATION.md) - Contract normalization details
3. [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Multi-contract parsing

**Troubleshooting issues?**
1. [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Installation problems
2. [ISSUE_299_FIX.md](./ISSUE_299_FIX.md) - Metadata parsing issues
3. [JALEN_WILSON_INVESTIGATION.md](./JALEN_WILSON_INVESTIGATION.md) - Edge cases
