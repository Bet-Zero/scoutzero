# Output File Structure (Draft Picks)

## Current Structure

After the cleanup, the RealGM scraper now writes **one canonical file per team**:

```
team-scrape/draft-picks/output/
└── structured/
    └── draft_picks_{TEAM}.json
```

- Each file contains the full structured payload for that team (as scraped from its RealGM page).
- No aggregate or “by current owner” JSON files are produced by default.
- Debug/raw outputs are opt-in only (env flags), so the directory stays clean for day-to-day runs.

## Authoritative Location

| Dataset                        | Path                                                                | Notes                               |
| ------------------------------ | ------------------------------------------------------------------- | ----------------------------------- |
| Team salary data (SalarySwish) | `team-scrape/team-data/output/team_{CODE}.json`                     | Produced by `npm run parse`         |
| Draft pick data (RealGM)       | `team-scrape/draft-picks/output/structured/draft_picks_{CODE}.json` | Produced by `npm run realgm:drafts` |

These two directories are the only sources consumed by the merge and staging scripts.

## Optional / Debug Outputs

The RealGM scraper can still emit diagnostic files when needed:

- Set `WRITE_COMBINED=1` to produce combined JSON snapshots (raw + structured + by owner).
- Set `SAVE_DEBUG_HTML=1` to archive the fetched HTML pages.

Both flags are disabled by default, keeping the repository free of redundant artifacts.

## Usage Guidelines

- **Applications** should read from `structured/draft_picks_{TEAM}.json`.
- **Pipeline tooling** (merge/stage) already points at this directory and requires no changes.
- **Developers** can enable optional outputs locally if they need to investigate scraping issues, but those files should not be committed.

### Canonical Pick Shape

Each entry in `structured/draft_picks_{TEAM}.json` contains only picks the team currently owns. (Outgoing obligations remain visible in the RealGM scrape but are filtered out during serialization.)

## Next Steps

- Standardize the JSON shape that `draft_picks_{TEAM}.json` emits (see plan step 3).
- Update any consumers that were previously reading the aggregated files (should now resolve directly to the per-team payloads).
