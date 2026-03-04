import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../../../package.json');
const rulesRunnerPath = path.resolve(
  __dirname,
  '../../../scripts/ci/run_rules_integration_tests.mjs'
);
const rulesVitestConfigPath = path.resolve(
  __dirname,
  '../../../vitest.rules.config.js'
);

function readText(filePath: string): string {
  expect(fs.existsSync(filePath)).toBe(true);
  return fs.readFileSync(filePath, 'utf8');
}

describe('Architect rules integration harness guardrails', () => {
  it('keeps npm test:rules pinned to emulator host and dedicated runner', () => {
    const packageJson = JSON.parse(readText(packageJsonPath));
    const scripts = packageJson.scripts || {};

    expect(typeof scripts['test:rules']).toBe('string');
    expect(scripts['test:rules']).toContain(
      'FIRESTORE_EMULATOR_HOST=127.0.0.1:8082'
    );
    expect(scripts['test:rules']).toContain(
      'scripts/ci/run_rules_integration_tests.mjs'
    );
  });

  it('keeps rules runner on vitest.rules.config.js (not test:node)', () => {
    const runner = readText(rulesRunnerPath);

    expect(runner).toContain("'vitest.rules.config.js'");
    expect(runner).toContain(
      "'src/tests/security/firestoreRules.integration.test.ts'"
    );

    expect(runner).not.toContain("'test:node'");
    expect(runner).not.toContain('vitest.node.config.js');
    expect(runner).not.toContain('setupFirebaseMocks.js');
  });

  it('keeps rules Vitest config free of firebase mock setup', () => {
    const config = readText(rulesVitestConfigPath);

    expect(config).toContain("setupFiles: ['./tests/setupDebug.js']");
    expect(config).not.toContain('setupFirebaseMocks.js');
    expect(config).toContain(
      "include: ['src/tests/security/firestoreRules.integration.test.ts']"
    );
  });
});
