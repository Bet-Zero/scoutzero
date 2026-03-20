import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  writeBatchMock: vi.fn((): any => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(async (): Promise<any> => undefined),
  })),
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
  updateWorldStats: vi.fn(async (): Promise<any> => undefined),
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({ valid: true, legal: true, success: true })),
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [] as any[], warnings: [] as any[] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [] as any[], warnings: [] as any[] })),
  validateExtension: vi.fn(() => ({ valid: true, violations: [] as any[], warnings: [] as any[] })),
  validateOptionDecision: vi.fn(() => ({ valid: true, violations: [] as any[], warnings: [] as any[] })),
  validateOfferSheetResolution: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateRenounceRights: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateDeadCap: vi.fn(() => ({ violations: [] as any[], warnings: [] as any[] })),
  validateExceptions: vi.fn(() => ({ violations: [] as any[], warnings: [] as any[] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
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
    'buildWorldMutationEventPayload',
    'computeWorldMutation',
    'resolveWorldAsOfDate',
    'sanitizeTransientFieldsForPersistence',
    'validatePostTradeSnapshotForContext',
  ] as const;
  const expectedSourceOrder = [
    'export { buildPostTradeTeamsSnapshot, validatePostTradeSnapshotForContext };',
    'export { FORBIDDEN_TRANSIENT_KEYS, sanitizeTransientFieldsForPersistence };',
    'export function resolveWorldAsOfDate',
    'export function buildWorldMutationEventPayload',
    'export async function applyWorldMutation',
    'export function computeWorldMutation',
  ] as const;

  it('deletes the mutationPipeline.js compatibility shim', () => {
    expect(fs.existsSync(shimPath)).toBe(false);
  });

  it('extensionless imports expose the same named API as the TS authority', async () => {
    const authorityModule = await import(authoritySpecifier);

    expect(Object.keys(authorityModule).sort()).toEqual(
      Array.from(expectedExports).sort()
    );
    expect(Object.keys(mutationPipelineModule).sort()).toEqual(
      Array.from(expectedExports).sort()
    );
    expect('default' in authorityModule).toBe(false);

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
