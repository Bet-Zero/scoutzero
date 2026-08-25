import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fs.readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../features/architect/utils/seasonManager.ts'
  ),
  'utf8'
);

describe('Season Advance post-state validator fail-close', () => {
  it('reconciles final state before opening the atomic transaction', () => {
    const validationIndex = source.indexOf(
      'const postStateValidation = validatePostStateCapLegality({'
    );
    const failureIndex = source.indexOf('if (!postStateValidation.valid) {');
    const transactionIndex = source.indexOf('await runTransaction(');

    expect(validationIndex).toBeGreaterThan(-1);
    expect(failureIndex).toBeGreaterThan(validationIndex);
    expect(transactionIndex).toBeGreaterThan(failureIndex);
    expect(source.slice(failureIndex, transactionIndex)).toContain(
      "error: 'Post-state cap validation failed for season advance'"
    );
    expect(source.slice(failureIndex, transactionIndex)).toContain(
      'violations: postStateValidation.violations'
    );
  });
});
