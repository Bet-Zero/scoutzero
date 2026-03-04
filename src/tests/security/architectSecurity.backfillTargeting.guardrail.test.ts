import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../../../package.json');
const scriptPath = path.resolve(
  __dirname,
  '../../../scripts/admin/architectSecurityBackfill.ts'
);

function readPackageJson(): Record<string, any> {
  expect(fs.existsSync(packageJsonPath)).toBe(true);
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function readBackfillScript(): string {
  expect(fs.existsSync(scriptPath)).toBe(true);
  return fs.readFileSync(scriptPath, 'utf8');
}

describe('Architect security backfill targeting guardrails', () => {
  it('pins admin security npm scripts to Firestore emulator host 127.0.0.1:8082', () => {
    const packageJson = readPackageJson();
    const scripts = packageJson.scripts || {};

    expect(scripts['admin:security:audit']).toContain(
      'FIRESTORE_EMULATOR_HOST=127.0.0.1:8082'
    );
    expect(scripts['admin:security:apply']).toContain(
      'FIRESTORE_EMULATOR_HOST=127.0.0.1:8082'
    );
    expect(scripts['admin:security:audit']).toContain('cross-env');
    expect(scripts['admin:security:apply']).toContain('cross-env');
  });

  it('fails closed by resolving emulator host or refusing prod mode', () => {
    const script = readBackfillScript();

    expect(script).toContain('function resolveEmulatorTarget()');
    expect(script).toContain('FIRESTORE_EMULATOR_HOST');
    expect(script).toContain('if (options.prod)');
    expect(script).toContain(
      'Prod mode disabled. Remove this guard only when explicitly re-authorized.'
    );
    expect(script).toContain('Missing FIRESTORE_EMULATOR_HOST');
    expect(script).toContain('Refusing to continue.');
  });

  it('prints startup targeting banner with explicit target and mode context', () => {
    const script = readBackfillScript();

    expect(script).toContain('ARCHITECT SECURITY BACKFILL — TARGETING LOCK');
    expect(script).toContain('Target: EMULATOR (PROD disabled)');
    expect(script).toContain('Mode:');
    expect(script).toContain('ProjectId:');
  });

  it('does not contain hardcoded legacy emulator port 8080', () => {
    const script = readBackfillScript();
    expect(script).not.toContain('8080');
  });
});
