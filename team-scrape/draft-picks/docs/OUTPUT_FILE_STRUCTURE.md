# Output File Structure (Draft Picks)

## Current Structure

The RealGM scraper produces **two output directories** per team:

```
team-scrape/draft-picks/_artifacts/output/
├── mentions/
│   └── draft_picks_mentions_{TEAM}.json   # ALL picks from team's page (including outgoing)
└── structured/
    └── draft_picks_{TEAM}.json            # Only picks team currently owns (inventory)
```

### Output Types

| Type | File Pattern | Contents | Purpose |
|------|--------------|----------|---------|
| **Mentions** | `mentions/draft_picks_mentions_{TEAM}.json` | ALL picks parsed from team's RealGM page (own + outgoing + incoming + conditional + contested) | Ledger builder input (captures complete trade data) |
| **Inventory** (Structured) | `structured/draft_picks_{TEAM}.json` | Only picks where `currentOwner === TEAM` | Backward compatibility, quick inventory lookups |

### Which Output to Use

- **Ledger Builder**: Uses **mentions** directory by default (captures outgoing picks that would otherwise be lost)
- **Applications**: Can use **structured** directory for quick inventory lookups (owned-only)

## Canonical Pick ID Strategy

The scraper uses a **stable base ID** that does not change when protection details change:

### Base Asset ID (Stable, Dedupable)

```
{ORIGINAL_TEAM}_{YEAR}_{1st|2nd}
```

Examples:
- `LAL_2029_1st` — Lakers' 2029 first round pick
- `PHI_2026_2nd` — Philadelphia's 2026 second round pick

### Derived IDs (When Applicable)

| ID Type | Pattern | When Used |
|---------|---------|-----------|
| `swapId` | `${baseId}_swap_${counterparty}` | Swap rights scenarios |
| `obligationId` | `${baseId}_obligation_${recipient}` | Outgoing/conditional picks with known recipient |
| `legacyId` | Old descriptive ID format | Backward compatibility with existing consumers |

### What Is NOT in Base ID

The base ID intentionally excludes:
- Protection details (`top-4 protected`, `lottery protected`)
- Direction suffixes (`to_DAL`, `from_PHI`)
- Status suffixes (`conditional`, `contested`, `swap`)

This ensures IDs remain stable across protection changes and conveyance scenarios.

## Ledger Builder Usage

```bash
# Default: reads from mentions directory
npx tsx team-scrape/shared/ledger/buildPickLedger.ts

# Explicit: use mentions (default)
npx tsx team-scrape/shared/ledger/buildPickLedger.ts --input=mentions

# Legacy: use structured (owned-only)
npx tsx team-scrape/shared/ledger/buildPickLedger.ts --input=structured
```

## Authoritative Locations

| Dataset | Path | Producer |
|---------|------|----------|
| Team salary data (SalarySwish) | `team-scrape/team-data/output/team_{CODE}.json` | `npm run parse` |
| Draft pick mentions (RealGM) | `team-scrape/draft-picks/_artifacts/output/mentions/draft_picks_mentions_{CODE}.json` | `npm run team:draft-picks` |
| Draft pick inventory (RealGM) | `team-scrape/draft-picks/_artifacts/output/structured/draft_picks_{CODE}.json` | `npm run team:draft-picks` |

## Canonical Pick Shape

Each entry in the output files follows this structure:

```typescript
{
  id: string;                    // Stable base ID: {ORIGINAL}_{YEAR}_{1st|2nd}
  legacyId?: string;             // Old descriptive ID (if different from base)
  year: number;
  round: 1 | 2;
  status: 'own' | 'outgoing' | 'incoming' | 'contested' | 'conditional';
  originalTeam: string;
  currentOwner: string;
  stepienEligible: boolean;
  tradeable: boolean;
  protection?: string | null;
  isSwap: boolean;
  via?: string;
  recipient?: string;
  // ... additional optional fields
  swapId?: string;               // Derived ID for swap rights
  obligationId?: string;         // Derived ID for outgoing obligations
}
```

## Optional / Debug Outputs

The RealGM scraper can emit diagnostic files when needed:

- Set `WRITE_COMBINED=1` to produce combined JSON snapshots
- Set `SAVE_DEBUG_HTML=1` to archive fetched HTML pages

Both flags are disabled by default.

## Usage Guidelines

- **Ledger Builder** should read from `mentions/` directory (default)
- **Quick lookups** can use `structured/` directory for owned-only picks
- **Developers** can enable optional outputs locally for debugging
