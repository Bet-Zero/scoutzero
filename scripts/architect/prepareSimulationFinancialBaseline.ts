import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prepareSimulationFinancialBaseline } from '../../src/features/architect/utils/prepareSimulationFinancialBaseline';

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    'Usage: node --import tsx scripts/architect/prepareSimulationFinancialBaseline.ts <private-reconciled-input.json> <private-output.json>'
  );
const prepared = await prepareSimulationFinancialBaseline(
  JSON.parse(await readFile(input, 'utf8'))
);
const bytes = JSON.stringify(prepared);
await writeFile(output, bytes, { flag: 'wx', mode: 0o600 });
console.log(
  JSON.stringify({
    classification: prepared.classification,
    teams: Object.keys(prepared.teams).length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    output,
  })
);
