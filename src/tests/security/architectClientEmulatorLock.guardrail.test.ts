import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfigPath = path.resolve(
  __dirname,
  '../../../src/firebaseConfig.ts'
);
const packageJsonPath = path.resolve(__dirname, '../../../package.json');
const gmDashboardPath = path.resolve(
  __dirname,
  '../../../src/features/architect/GMDashboard/GMDashboard.tsx'
);
const modePillPath = path.resolve(
  __dirname,
  '../../../src/features/architect/cockpit/ModePill.tsx'
);
const firebaseJsonPath = path.resolve(__dirname, '../../../firebase.json');

function readText(filePath: string): string {
  expect(fs.existsSync(filePath)).toBe(true);
  return fs.readFileSync(filePath, 'utf8');
}

describe('Architect client emulator lock guardrails', () => {
  it('keeps firebase.json Firestore emulator pinned to 127.0.0.1:8082', () => {
    const parsed = JSON.parse(readText(firebaseJsonPath));
    expect(parsed?.emulators?.firestore?.host).toBe('127.0.0.1');
    expect(parsed?.emulators?.firestore?.port).toBe(8082);
  });

  it('enforces DEV => EMULATOR target mode and wires emulator connectors', () => {
    const source = readText(firebaseConfigPath);

    expect(source).toContain('export function getFirebaseTargetMode()');
    expect(source).toContain(
      'if (import.meta.env.DEV || requestedEmulatorMode === true)'
    );
    expect(source).toContain('return FIREBASE_TARGET_MODES.EMULATOR');

    expect(source).toContain('connectFirestoreEmulator');
    expect(source).toContain('connectAuthEmulator');
    expect(source).toContain('connectFunctionsEmulator');
    expect(source).toContain(
      'FIREBASE_TARGET_MODE === FIREBASE_TARGET_MODES.EMULATOR'
    );
  });

  it('has no legacy Firestore emulator port 8080 in client firebase init path', () => {
    const source = readText(firebaseConfigPath);
    expect(source).not.toContain('8080');
  });

  it('pins npm dev script to emulator mode and renders mode/failure indicators', () => {
    const packageJson = JSON.parse(readText(packageJsonPath));
    const scripts = packageJson.scripts || {};
    const gmDashboard = readText(gmDashboardPath);
    const modePill = readText(modePillPath);

    expect(scripts.dev).toContain('VITE_USE_FIREBASE_EMULATORS=true');
    expect(scripts.dev).toContain('cross-env');

    // Mode labels live in cockpit ModePill after GM desk shell migration.
    expect(modePill).toContain('EMULATOR MODE');
    expect(modePill).toContain('PROD MODE');
    expect(gmDashboard).toContain(
      'Emulator mode: Firebase emulators not detected. Start them with: npm'
    );
    expect(gmDashboard).toContain('run emu');
  });
});
