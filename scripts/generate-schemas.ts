/* eslint-disable no-console */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

async function main() {
  const outJsonDir = resolve(process.cwd(), 'schemas/json');
  const outDocsDir = resolve(process.cwd(), 'docs/schema');
  mkdirSync(outJsonDir, { recursive: true });
  mkdirSync(outDocsDir, { recursive: true });

  // Lazy import app schemas
  const playersSchemas = await import('../src/schemas/players_v2');
  const architectSchemas = await import('../src/schemas/architect');

  // Attempt JSON Schema generation using zod-to-json-schema if available
  let zodToJsonSchema: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    zodToJsonSchema = require('zod-to-json-schema');
  } catch {
    console.warn('zod-to-json-schema not installed. Skipping JSON schema generation.');
  }

  if (zodToJsonSchema) {
    const { zodToJsonSchema: toJson } = zodToJsonSchema;
    const playersMain = toJson(playersSchemas.PlayerMainDocZ, 'PlayerMainDoc');
    const contract = toJson(playersSchemas.ContractDocZ, 'ContractDoc');
    const season = toJson(playersSchemas.SeasonDocZ, 'SeasonDoc');
    const evaluation = toJson(playersSchemas.EvaluationDocZ, 'EvaluationDoc');
    writeFileSync(resolve(outJsonDir, 'players_v2.PlayerMainDoc.schema.json'), JSON.stringify(playersMain, null, 2));
    writeFileSync(resolve(outJsonDir, 'players_v2.ContractDoc.schema.json'), JSON.stringify(contract, null, 2));
    writeFileSync(resolve(outJsonDir, 'players_v2.SeasonDoc.schema.json'), JSON.stringify(season, null, 2));
    writeFileSync(resolve(outJsonDir, 'players_v2.EvaluationDoc.schema.json'), JSON.stringify(evaluation, null, 2));

    const baseTeam = toJson(architectSchemas.BaseTeamDocZ, 'BaseTeamDoc');
    const basePlayer = toJson(architectSchemas.BasePlayerDocZ, 'BasePlayerDoc');
    const worldTeam = toJson(architectSchemas.WorldTeamSnapshotZ, 'WorldTeamSnapshot');
    writeFileSync(resolve(outJsonDir, 'architect.BaseTeamDoc.schema.json'), JSON.stringify(baseTeam, null, 2));
    writeFileSync(resolve(outJsonDir, 'architect.BasePlayerDoc.schema.json'), JSON.stringify(basePlayer, null, 2));
    writeFileSync(resolve(outJsonDir, 'architect.WorldTeamSnapshot.schema.json'), JSON.stringify(worldTeam, null, 2));
  }

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
      ['evaluations/*', 'Evaluation documents (see EvaluationDoc)']
    ])
  );

  writeFileSync(
    resolve(outDocsDir, 'architect.md'),
    md('architect (canonical)', [
      ['/architect/baseTeams/{teamCode}', 'BaseTeamDoc'],
      ['/architect/basePlayers/{playerId}', 'BasePlayerDoc'],
      ['/architect/worlds/{worldId}/snapshot/teams/{teamCode}', 'WorldTeamSnapshot']
    ])
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


