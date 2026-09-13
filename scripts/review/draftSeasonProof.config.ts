/** The certificate coordinator owns one isolated emulator across bounded phases. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../../playwright.config';

if (process.env.SCOUTZERO_SHARED_SEASON_PROOF !== 'true') {
  throw new Error(
    'Run the season proof through architect:proof:trade-receipt.'
  );
}
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
export default {
  ...config,
  testDir: path.join(root, 'tests/e2e'),
  webServer: undefined,
};
