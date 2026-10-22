import { readFile, writeFile } from 'node:fs/promises';
import { prepareDraftReviewDocuments } from '../../server/draftReviewFirestore.js';

// Offline preparation only. No SDK, credentials, network, or publication command.
const [input, output] = process.argv.slice(2);
if (!input || !output || process.argv.length !== 4)
  throw new Error(
    'Usage: npm run architect:draft-review:prepare -- <private-input.json> <private-output.json>'
  );
const documents = prepareDraftReviewDocuments(await readFile(input));
await writeFile(output, JSON.stringify({ documents }), {
  flag: 'wx',
  mode: 0o600,
});
console.log(
  `Prepared ${documents.length} immutable Firestore documents locally. No publication performed.`
);
