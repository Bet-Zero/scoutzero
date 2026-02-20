/**
 * FILE: src/tests/architect/saveEntitlementExclusivity.test.ts
 * PURPOSE: Tests for the exclusivity gate wired into saveEntitlementFromFormState.
 *          Validates that saves are blocked when exclusivity violations exist.
 * OWNERSHIP: Test suite (TM-EXCL-E1: Entitlement Exclusivity Foundation)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E1 execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock all external dependencies BEFORE importing the module under test ───

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

// Mock the entitlement writer (writeWorldEntitlement, validateEntitlementDocument)
const mockWriteWorldEntitlement = vi.fn().mockResolvedValue({ success: true });
const mockValidateEntitlementDocument = vi
  .fn()
  .mockReturnValue({ valid: true });
vi.mock('@/features/architect/utils/entitlements/entitlementWriter', () => ({
  validateEntitlementDocument: (...args: unknown[]) =>
    mockValidateEntitlementDocument(...args),
  writeWorldEntitlement: (...args: unknown[]) =>
    mockWriteWorldEntitlement(...args),
}));

// Mock vacuum overlay store
vi.mock(
  '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore',
  () => ({
    applyVacuumEdit: vi.fn(),
    applyVacuumCreate: vi.fn(),
    rekeyVacuumCreate: vi.fn(),
    resolveVacuumEditCollisions: vi.fn(),
    findVacuumCreateByIdentityKey: vi.fn().mockReturnValue(null),
  })
);

// Mock entitlement identity
vi.mock('@/features/architect/utils/entitlements/entitlementIdentity', () => ({
  getEntitlementDeterministicId: vi.fn().mockReturnValue('det-id-001'),
  getVacuumDeterministicId: vi.fn().mockReturnValue('vacuum:det-id-001'),
  getEntitlementIdentityKey: vi
    .fn()
    .mockReturnValue('own:LAL:2026:1:LAL_2026_1st'),
}));

// Mock moveWorldEntitlement
vi.mock('@/features/architect/utils/entitlements/moveWorldEntitlement', () => ({
  moveWorldEntitlement: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock the resolver — this is the key dependency for exclusivity gate
const mockResolveEntitlementsForTeam = vi.fn().mockResolvedValue([]);
vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlementsForTeam: (...args: unknown[]) =>
    mockResolveEntitlementsForTeam(...args),
}));

// Mock the exclusivity validator — we spy on this to control results
const mockValidateExclusivity = vi
  .fn()
  .mockReturnValue({ valid: true, violations: [] });
vi.mock(
  '@/features/architect/utils/entitlements/entitlementExclusivityValidator',
  () => ({
    validateEntitlementExclusivity: (...args: unknown[]) =>
      mockValidateExclusivity(...args),
  })
);

// ─── Import module under test AFTER mocks ────────────────────────────────────

import { saveEntitlementFromFormState } from '@/features/architect/admin/saveEntitlementFromFormState';
import type { EntitlementFormState } from '@/features/architect/admin/entitlementEditorFormState';
import { toast } from 'react-hot-toast';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeFormState(
  overrides: Partial<EntitlementFormState> = {}
): EntitlementFormState {
  return {
    id: '',
    holderTeam: 'LAL',
    seasonYear: '2026',
    round: '1',
    kind: 'swap_right',
    description: 'Test swap',
    underlyingPickId: '',
    underlyingStatus: '',
    swapControllerPickId: 'BOS_2027_1st',
    swapTargetDefinition: 'Boston first round pick',
    swapType: 'best_of',
    poolUnderlyingPickIdsText: '',
    receivesRankText: '',
    receivesComparator: '',
    protectionLadder: [],
    linkedEntitlementIdsText: '',
    residualOfEntitlementId: '',
    coveredByEntitlementIdsText: '',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Save gate: exclusivity check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateEntitlementDocument.mockReturnValue({ valid: true });
    mockResolveEntitlementsForTeam.mockResolvedValue([]);
    mockValidateExclusivity.mockReturnValue({ valid: true, violations: [] });
    mockWriteWorldEntitlement.mockResolvedValue({ success: true });
  });

  it('blocks save when swapControllerPickId already exists on team', async () => {
    // Existing entitlement: a swap on BOS_2027_1st
    mockResolveEntitlementsForTeam.mockResolvedValue([
      {
        id: 'existing-ent',
        kind: 'swap_right',
        swapControllerPickId: 'BOS_2027_1st',
        holderTeam: 'LAL',
      },
    ]);
    mockValidateExclusivity.mockReturnValue({
      valid: false,
      violations: [
        {
          type: 'DUP_SWAP_CONTROLLER',
          message: 'Duplicate swap controller for BOS_2027_1st',
          entitlementIds: ['existing-ent', 'det-id-001'],
          underlyingPickIds: ['BOS_2027_1st'],
        },
      ],
    });

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: undefined, // new create
      formState: makeFormState(),
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('EXCLUSIVITY');
    expect(result.violations).toHaveLength(1);
    expect(result.violations![0].type).toBe('DUP_SWAP_CONTROLLER');
    expect(toast.error).toHaveBeenCalled();
    // Firestore write should NOT have been called
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
  });

  it('blocks save when underlyingPickId already exists for pick_ownership', async () => {
    const formState = makeFormState({
      kind: 'pick_ownership',
      underlyingPickId: 'LAL_2026_1st',
      swapControllerPickId: '',
      swapTargetDefinition: '',
      swapType: '',
    });

    mockResolveEntitlementsForTeam.mockResolvedValue([
      {
        id: 'existing-ent',
        kind: 'pick_ownership',
        underlyingPickId: 'LAL_2026_1st',
        holderTeam: 'LAL',
      },
    ]);
    mockValidateExclusivity.mockReturnValue({
      valid: false,
      violations: [
        {
          type: 'DUP_PICK_OWNERSHIP_UNDERLIER',
          message: 'Duplicate pick ownership for LAL_2026_1st',
          entitlementIds: ['existing-ent', 'det-id-001'],
          underlyingPickIds: ['LAL_2026_1st'],
        },
      ],
    });

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: undefined,
      formState,
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('EXCLUSIVITY');
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
  });

  it('allows editing existing entitlement without identity change (self-edit)', async () => {
    mockResolveEntitlementsForTeam.mockResolvedValue([
      {
        id: 'ent-abc',
        kind: 'swap_right',
        swapControllerPickId: 'BOS_2027_1st',
        holderTeam: 'LAL',
      },
    ]);
    // Validator returns valid because the candidate id matches existing
    mockValidateExclusivity.mockReturnValue({ valid: true, violations: [] });

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: 'ent-abc', // editing existing
      formState: makeFormState(),
    });

    expect(result.success).toBe(true);
    expect(result.errorType).toBeUndefined();
  });

  it('blocks edit that changes identity into conflict (no move executed)', async () => {
    mockResolveEntitlementsForTeam.mockResolvedValue([
      {
        id: 'ent-abc',
        kind: 'swap_right',
        swapControllerPickId: 'BOS_2027_1st',
        holderTeam: 'LAL',
      },
      {
        id: 'ent-other',
        kind: 'swap_right',
        swapControllerPickId: 'MIA_2027_1st',
        holderTeam: 'LAL',
      },
    ]);
    // The candidate changes from BOS_2027_1st to MIA_2027_1st → conflicts with ent-other
    mockValidateExclusivity.mockReturnValue({
      valid: false,
      violations: [
        {
          type: 'DUP_SWAP_CONTROLLER',
          message: 'Duplicate swap controller for MIA_2027_1st',
          entitlementIds: ['ent-other', 'ent-abc'],
          underlyingPickIds: ['MIA_2027_1st'],
        },
      ],
    });

    const { moveWorldEntitlement } = await import(
      '@/features/architect/utils/entitlements/moveWorldEntitlement'
    );

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: 'ent-abc', // editing — would trigger identity-change move
      formState: makeFormState({ swapControllerPickId: 'MIA_2027_1st' }),
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('EXCLUSIVITY');
    // Move should NOT have been called
    expect(moveWorldEntitlement).not.toHaveBeenCalled();
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
  });

  it('passes through to save when exclusivity check is valid', async () => {
    mockValidateExclusivity.mockReturnValue({ valid: true, violations: [] });

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: undefined,
      formState: makeFormState(),
    });

    expect(result.success).toBe(true);
    expect(result.errorType).toBeUndefined();
    expect(mockWriteWorldEntitlement).toHaveBeenCalled();
  });

  it('calls resolver with correct storageMode args (world)', async () => {
    await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'my-world',
      userId: 'test-user',
      entitlementId: undefined,
      formState: makeFormState(),
    });

    expect(mockResolveEntitlementsForTeam).toHaveBeenCalledWith(
      'my-world',
      'LAL'
    );
  });

  it('calls resolver with null for vacuum mode', async () => {
    await saveEntitlementFromFormState({
      storageMode: 'vacuum',
      worldId: null,
      userId: null,
      entitlementId: undefined,
      formState: makeFormState(),
    });

    expect(mockResolveEntitlementsForTeam).toHaveBeenCalledWith(null, 'LAL');
  });

  // ── TM-EXCL-E1.1: Integrity-first — block save when validation unavailable ──

  it('resolver failure blocks save with EXCLUSIVITY_VALIDATION_UNAVAILABLE', async () => {
    mockResolveEntitlementsForTeam.mockRejectedValue(
      new Error('Firestore unavailable')
    );

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: undefined,
      formState: makeFormState(),
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('EXCLUSIVITY_VALIDATION_UNAVAILABLE');
    expect(result.error).toContain('unavailable');
    // Firestore write should NOT have been called
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
  });

  it('validator throw blocks save with EXCLUSIVITY_VALIDATION_UNAVAILABLE', async () => {
    mockResolveEntitlementsForTeam.mockResolvedValue([
      {
        id: 'existing-ent',
        kind: 'swap_right',
        swapControllerPickId: 'BOS_2027_1st',
        holderTeam: 'LAL',
      },
    ]);
    // Validator throws unexpectedly
    mockValidateExclusivity.mockImplementation(() => {
      throw new Error('Unexpected validator failure');
    });

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: undefined,
      formState: makeFormState(),
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('EXCLUSIVITY_VALIDATION_UNAVAILABLE');
    expect(result.error).toContain('unavailable');
    // Firestore write should NOT have been called
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
  });
});
