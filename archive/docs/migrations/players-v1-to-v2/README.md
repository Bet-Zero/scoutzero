# Players Migration Documentation (v1 → v2)

## Overview

This directory contains migration documentation for the transition from the original `players` collection (flat structure) to `players_v2` collection (hierarchical structure).

## Migration Status

- **Current State**: Using `players_v2` collection in production
- **Migration Date**: [Add your migration date]
- **Rollback Available**: Yes - original `players` collection preserved

## Schema References

### Current Schema (v2)

- **File**: `schema-lock-players_v2/players_schema.lock.json`
- **Purpose**: Lock file for current `players_v2` hierarchical structure
- **Usage**: Reference for current code development
- **Structure**: Bio, contracts, seasons, evaluations as subcollections

### Legacy Schema (v1)

- **Collection**: Original `players` collection (flat structure)
- **Status**: Preserved for rollback safety
- **Usage**: Reference when updating old code that expects flat structure

### Migration Schema Documentation

- **File**: `FIRESTORE_SCHEMA_V2.md`
- **Purpose**: Documents the v2 hierarchical structure in detail
- **Usage**: Understanding subcollections and field mappings

## Code Migration Guidelines

### Frontend Code Updates Needed

When updating code from v1 (flat) to v2 (hierarchical):

```javascript
// OLD (v1 flat structure):
player.display_name;
player.AGE;
player.contract.salary;

// NEW (v2 hierarchical):
player.bio.displayName;
player.bio.age;
player.contracts[contractId].salary;
```

### Collection References

- **Production**: Use `players_v2` for all new queries
- **Development**: Test against `players_v2`
- **Rollback**: `players` collection still available if needed

## Important Notes

- Keep this documentation until migration is fully stable
- Update frontend code references from v1 to v2 patterns
- Test thoroughly before removing v1 fallbacks
- This documentation helps AI understand the migration context

---

_This is migration documentation - not current API reference_
_For current schema docs, see main docs/ directory_
