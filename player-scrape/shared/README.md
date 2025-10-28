# Shared Utilities

This directory contains shared code used across both contract and stats scraping modules.

## Contents

### Schema

- **`schema/player_scrape_schema.ts`** - Zod schemas and TypeScript types for player data validation

## Purpose

The shared directory provides:

- Common type definitions
- Validation schemas
- Utility functions (future)
- Shared constants (future)

## Usage

Import shared resources from this directory in both `contracts/` and `stats/` modules:

```typescript
import { basePlayerSchema } from '../../shared/schema/player_scrape_schema.ts';
```

## Adding Shared Code

When code is used by both contract and stats modules, it should be placed here to avoid duplication.
