// stats/scripts/validate_stats.ts
// Validate parsed stats object against a Zod schema

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal Season schema aligned with src/types SeasonDoc
const StatsSchema = z.record(z.number());

const SeasonDocSchema = z.object({
  team: z.string().optional(),
  age: z.number().optional(),
  pos: z.string().optional(),
  stats: StatsSchema,
});

const OutputSchema = z.object({
  playerId: z.string(),
  teamCode: z.string().optional(),
  seasons: z.record(SeasonDocSchema),
  meta: z
    .object({
      lastStatsUpdate: z
        .object({ _seconds: z.number().optional(), _nanoseconds: z.number().optional() })
        .partial()
        .optional(),
      statsSeasonTag: z.string().optional(),
      statsCarryOver: z.boolean().optional(),
    })
    .optional(),
});

async function main() {
  const playerFile = process.env.PLAYER_FILE || 'player.json';
  const teamCode = process.env.TEAM_CODE;
  const outDir = path.join(__dirname, '../output');

  async function findFile(): Promise<string | null> {
    if (teamCode) {
      const p = path.join(outDir, teamCode, playerFile);
      try {
        await fs.access(p);
        return p;
      } catch {}
      return null;
    }
    try {
      const entries = await fs.readdir(outDir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const p = path.join(outDir, e.name, playerFile);
        try {
          await fs.access(p);
          return p;
        } catch {}
      }
    } catch {}
    return null;
  }

  const filePath = await findFile();
  if (!filePath) {
    console.error('❌ File not found:', playerFile);
    process.exit(1);
  }

  const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const res = OutputSchema.safeParse(data);
  if (!res.success) {
    console.error('❌ Validation failed');
    for (const issue of res.error.issues) {
      console.error(`- ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log('✅ Stats validation successful');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}


