# Headshot Downloader

Downloads NBA player headshots from the official NBA CDN and saves them to `public/assets/headshots/`.

## Purpose

This tool replaces the legacy Python script (`archive/data_pipeline/helpers/tools/pull_all_headshots.py`) with a TypeScript implementation that uses the modern `player_index.json` as the source of truth for player IDs and NBA IDs.

## Prerequisites

- `player-scrape/shared/_artifacts/outputs/player_index.json` must exist (run `npm run build:index` if missing)
- Node.js 18.17+ with TypeScript support

## Usage

### Annual Full-Season Refresh

Download/update headshots for all players in the index:

```bash
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --all
```

This will:

- Process every player in `player_index.json`
- Overwrite existing headshots by default
- Download from `https://cdn.nba.com/headshots/nba/latest/1040x760/{nbaId}.png`
- Save to `public/assets/headshots/{playerId}.png`

### Targeted Updates (Trades, New Signings)

Update headshots for specific players:

```bash
# Single player
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --filter=lebron_james

# Multiple players (comma-separated)
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --filter=lebron_james,austin_reaves,kristaps_porzingis
```

### Dry Run

Preview what would be downloaded without writing files:

```bash
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --all --dry-run
```

### Advanced Options

```bash
# Custom concurrency (default: 10)
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --all --concurrency=5

# Skip existing files (default: overwrite when --all)
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --filter=lebron_james --overwrite=false

# Combine options
npx tsx player-scrape/shared/tools/headshots/download_headshots.ts --filter=lebron_james,austin_reaves --overwrite=true --concurrency=3
```

## CLI Flags

| Flag                | Type    | Default                                    | Description                           |
| ------------------- | ------- | ------------------------------------------ | ------------------------------------- |
| `--all`             | boolean | `false`                                    | Process all players in index          |
| `--filter=<ids>`    | string  | `undefined`                                | Comma-separated player IDs to process |
| `--overwrite`       | boolean | `true` (when `--all`), `false` (otherwise) | Overwrite existing files              |
| `--dry-run`         | boolean | `false`                                    | Preview without writing files         |
| `--concurrency=<n>` | number  | `10`                                       | Max concurrent downloads              |

## Behavior

- **Default mode** (no flags): Processes all players, overwrites existing files
- **File naming**: Uses `playerId` from index (e.g., `lebron_james.png`, `kristaps_porzingis.png`)
- **Error handling**: Continues processing on failures, reports errors at end
- **Skip logic**: Skips files that exist unless `--overwrite` is set
- **Concurrency**: Uses manual queue management to limit concurrent downloads

## Output

Files are saved to `public/assets/headshots/{playerId}.png`. The tool prints:

- Per-player status (✅ ok, ⏭️ skipped, ❌ error)
- Summary statistics (ok/skipped/failed counts)
- Error details for failed downloads

## Integration

This tool is part of the player-scrape pipeline and reads from the same `player_index.json` used by:

- Contract scraping (`player-scrape/contracts/`)
- Stats scraping (`player-scrape/stats/`)
- Firestore staging (`player-scrape/firestore_staging/`)

## Notes

- Headshots are downloaded from the official NBA CDN
- File paths match the `playerId` format used throughout the codebase
- The tool respects existing files by default (unless `--all` or `--overwrite` is used)
- Failed downloads are logged but don't stop the batch process
