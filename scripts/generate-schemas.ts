/* eslint-disable no-console */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

async function main() {
  const outDocsDir = resolve(process.cwd(), 'docs/schema');
  mkdirSync(outDocsDir, { recursive: true });

  // Basic Markdown docs (lightweight, no deps)
  const md = (title: string, fields: Array<[string, string]>) => {
    const header = `# ${title}\n\n`;
    const tableHead = `| Field | Notes |\n|---|---|\n`;
    const rows = fields.map(([k, v]) => `| \`${k}\` | ${v} |`).join('\n');
    return header + tableHead + rows + '\n';
  };

  writeFileSync(
    resolve(outDocsDir, 'players_v2.md'),
    md('players_v2 (canonical)', [
      ['bio.*', 'Player bio and display fields'],
      ['contracts/*', 'Contract documents (see ContractDoc)'],
      ['seasons/*', 'Season documents (see SeasonDoc)'],
      ['evaluations/*', 'Evaluation documents (see EvaluationDoc)'],
    ]) +
      '\n' +
      '- Canonical source: `src/schemas/players_v2.ts`\n' +
      '\n## Notes\n' +
      '- Contract fields reconcile scraper outputs (`player-scrape`) with Firestore subcollection shape.\n' +
      '- Use types imported from `src/schemas/players_v2.ts` in code; do not redeclare interfaces elsewhere.\n'
  );

  writeFileSync(
    resolve(outDocsDir, 'architect.md'),
    md('architect (canonical)', [
      ['/architect/baseTeams/{teamCode}', 'BaseTeamDoc'],
      ['/architect/basePlayers/{playerId}', 'BasePlayerDoc'],
      ['/architect_worlds/{worldId}/teams/{teamCode}', 'WorldTeamSnapshot'],
    ]) +
      '\n' +
      '- Canonical source: `src/schemas/architect.ts`\n' +
      '\n## Notes\n' +
      '- Schemas defined by Zod in `src/schemas/architect.ts`.\n' +
      '- Use types imported from `src/schemas/architect.ts` in code; do not redeclare interfaces elsewhere.\n'
  );

  // Changelog placeholder if not present (idempotent for now)
  try {
    writeFileSync(
      resolve(outDocsDir, 'CHANGELOG.md'),
      '# Schema Changelog\n\n- v1: Initial canonical schemas established.\n',
      { flag: 'wx' }
    );
  } catch {
    // already exists
  }

  console.log('Schema generation complete (where possible).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
