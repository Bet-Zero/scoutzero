import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

type FirestoreWriteBatchMock = {
  set: (...args: unknown[]) => unknown;
  update: (...args: unknown[]) => unknown;
  commit: () => Promise<void>;
};

const harness = vi.hoisted(() => ({
  writeBatchMock: vi.fn(
    (): FirestoreWriteBatchMock => ({
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn(async (): Promise<void> => undefined),
    })
  ),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: harness.writeBatchMock,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((_db: unknown, ...segments: string[]) => segments.join('/')),
  doc: vi.fn((_db: unknown, ...segments: string[]) => segments.join('/')),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: vi.fn(async (): Promise<void> => undefined),
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({ valid: true, legal: true, success: true })),
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateExtension: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateOptionDecision: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateOfferSheetResolution: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateRenounceRights: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

import * as mutationPipelineModule from '@/features/architect/utils/mutationPipeline';

describe('E107 mutationPipeline compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const shimPath = path.join(srcRoot, 'utils/mutationPipeline.js');
  const authorityPath = path.join(srcRoot, 'utils/mutationPipeline.ts');
  const authoritySpecifier = '../../features/architect/utils/mutationPipeline.ts';
  const expectedExports = [
    'FORBIDDEN_TRANSIENT_KEYS',
    'applyWorldMutation',
    'buildPostTradeTeamsSnapshot',
    'buildPostStateRulesContext',
    'buildTotalsByTeam',
    'buildWorldMutationEventPayload',
    'computeWorldMutation',
    'extractTeamsByCodeFromComputeResult',
    'preflightOfferSheetMutation',
    'preflightSignAndTradeMutation',
    'resolveWorldAsOfDate',
    'sanitizeTransientFieldsForPersistence',
    'validateMutation',
    'validatePostTradeSnapshotForContext',
  ] as const;
  // Wave 4 Step 4c: read-phase helpers extracted to mutationPipeline.read.ts.
  // The orchestrator re-exports them via export * from './mutationPipeline.read'.
  // Source-order check updated to verify the new barrel structure.
  // Stage 6B: later refactors moved most pipeline functions into
  // sub-modules (mutationPipeline.preflights.ts, mutationPipeline.read.ts,
  // mutationPipeline.compute*.ts, mutationPipeline.normalize.ts,
  // mutationPipeline.helpers.ts) which are re-exported here via
  // `export *`. The substantive ordering invariant is:
  //   1. authority re-exports surface before the in-file functions
  //   2. applyWorldMutation is defined here
  //   3. validate/persist are re-exported from their split modules
  // Each snippet must appear in source and must appear in the listed
  // order relative to its peers.
  const expectedSourceOrder = [
    "export * from './mutationPipeline.helpers'",
    "export * from './mutationPipeline.read'",
    "export * from './mutationPipeline.preflights'",
    'export async function applyWorldMutation',
    "export { validateMutation } from './mutationPipeline.validate'",
  ] as const;

  it('deletes the mutationPipeline.js compatibility shim', () => {
    expect(fs.existsSync(shimPath)).toBe(false);
  });

  it('extensionless imports expose the same named API as the TS authority', async () => {
    const authorityModule = await import(authoritySpecifier);
    const authorityExports = Object.keys(authorityModule).sort();
    const compatibilityExports = Object.keys(mutationPipelineModule).sort();

    expect(authorityExports).toEqual(
      expect.arrayContaining(Array.from(expectedExports))
    );
    expect(compatibilityExports).toEqual(
      expect.arrayContaining(Array.from(expectedExports))
    );
    expect(authorityExports).toEqual(compatibilityExports);
    expect('default' in authorityModule).toBe(false);
    expect('default' in mutationPipelineModule).toBe(false);

    for (const exportName of expectedExports) {
      expect(authorityModule[exportName]).toBe(
        mutationPipelineModule[exportName]
      );
    }
  });

  it('mutationPipeline.ts preserves the named-export authority surface and has no default export', () => {
    const source = fs.readFileSync(authorityPath, 'utf-8');
    const positions = expectedSourceOrder.map((snippet) => source.indexOf(snippet));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(source).not.toContain('export default');
  });
});
