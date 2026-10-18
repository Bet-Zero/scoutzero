/** Production is an explicit operator operation after external factual review and owner approval. */
import { readFile } from 'node:fs/promises';
import { digest } from './cloudData.js';
import { canonical } from './cloudPipeline.js';
import { publishMaintenance } from './maintenancePublish.js';
import { maintenanceStore } from './maintenanceTransport.js';

try {
  const option = (key: string) => process.argv.find(v => v.startsWith('--' + key + '='))?.slice(key.length + 3);
  const plan = JSON.parse(await readFile(option('plan') || '', 'utf8'));
  const approval = JSON.parse(await readFile(option('approval') || '', 'utf8'));
  const production = process.argv.includes('--production');
  if (production && option('approved-plan-sha256') !== digest(canonical(plan))) throw new Error('Production requires the exact owner-approved plan digest');
  console.log(JSON.stringify(await publishMaintenance(plan, approval, await maintenanceStore(production))));
} catch {
  console.error('Publication stopped. Inspect the private plan, approval, live preconditions and completion records. No complete-publication claim is made.');
  process.exitCode = 1;
}
