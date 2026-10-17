import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/features/architect/utils/seasonManager.server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'functions/lib/architect/certifiedSeasonCore.cjs',
  external: ['firebase-admin', 'firebase-admin/*'],
  metafile: true,
  // Browser-only development flags are absent in the trusted Node runtime.
  define: { 'import.meta': '{}' },
  logLevel: 'warning',
});
if (
  Object.keys(result.metafile.inputs).some(
    (p) =>
      p.includes('firebaseConfig') ||
      p.includes('node_modules/firebase/') ||
      p.includes('node_modules/@firebase/')
  )
)
  throw new Error(
    'Certified server core must not include the client SDK or browser persistence.'
  );
// Cloud cache validation follows the actual server bundle inputs, not the whole UI.
await writeFile(path.join(root, 'functions/lib/certifiedSeason.inputs.json'), JSON.stringify(
  Object.keys(result.metafile.inputs).filter((file) => file.startsWith('src/')).sort()
));
