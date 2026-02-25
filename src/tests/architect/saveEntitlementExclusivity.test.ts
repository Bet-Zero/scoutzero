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

// Mock the entitlement writer
const mockWriteWorldEntitlement = vi.fn().mockResolvedValue({ success: true });
const mockWriteWorldEntitlementAndAttachToTeamAtomic = vi
  .fn()
  .mockResolvedValue({ success: true });
const mockValidateEntitlementDocument = vi
  .fn()
  .mockReturnValue({ valid: true });
vi.mock('@/features/architect/utils/entitlements/entitlementWriter', () => ({
  validateEntitlementDocument: (...args: unknown[]) =>
    mockValidateEntitlementDocument(...args),
  writeWorldEntitlement: (...args: unknown[]) =>
    mockWriteWorldEntitlement(...args),
  writeWorldEntitlementAndAttachToTeamAtomic: (...args: unknown[]) =>
    mockWriteWorldEntitlementAndAttachToTeamAtomic(...args),
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
const mockGetEntitlementDeterministicId = vi.fn();
vi.mock('@/features/architect/utils/entitlements/entitlementIdentity', () => ({
  getEntitlementDeterministicId: (...args: unknown[]) =>
    mockGetEntitlementDeterministicId(...args),
  getVacuumDeterministicId: vi.fn().mockReturnValue('vacuum:det-id-001'),
  getEntitlementIdentityKey: vi
    .fn()
    .mockReturnValue('own:LAL:2026:1:LAL_2026_1st'),
}));

// Mock the resolver — this is the key dependency for exclusivity gate
const mockResolveEntitlementsForTeam = vi.fn().mockResolvedValue([]);
const mockResolveEntitlement = vi
  .fn()
  .mockResolvedValue({ id: 'existing-linked', holderTeam: 'LAL' });
vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlementsForTeam: (...args: unknown[]) =>
    mockResolveEntitlementsForTeam(...args),
  resolveEntitlement: (...args: unknown[]) => mockResolveEntitlement(...args),
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

const mockRunLeagueClaimUniquenessGate = vi
  .fn()
  .mockResolvedValue({ ok: true });
vi.mock(
  '@/features/architect/utils/entitlements/leagueClaimUniquenessGate',
  () => ({
    runLeagueClaimUniquenessGate: (...args: unknown[]) =>
      mockRunLeagueClaimUniquenessGate(...args),
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
    mockResolveEntitlement.mockResolvedValue({
      id: 'existing-linked',
      holderTeam: 'LAL',
    });
    mockValidateExclusivity.mockReturnValue({ valid: true, violations: [] });
    mockRunLeagueClaimUniquenessGate.mockResolvedValue({ ok: true });
    mockWriteWorldEntitlement.mockResolvedValue({ success: true });
    mockWriteWorldEntitlementAndAttachToTeamAtomic.mockResolvedValue({
      success: true,
    });
    mockGetEntitlementDeterministicId.mockReturnValue('det-id-001');
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
    expect(
      mockWriteWorldEntitlementAndAttachToTeamAtomic
    ).not.toHaveBeenCalled();
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
    expect(
      mockWriteWorldEntitlementAndAttachToTeamAtomic
    ).not.toHaveBeenCalled();
  });

  it('allows editing existing entitlement without identity change (self-edit)', async () => {
    mockGetEntitlementDeterministicId.mockReturnValue('ent-abc');
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
    expect(result.saveOperation).toBe('UPDATE_SAME_IDENTITY');
    expect(mockWriteWorldEntitlement).toHaveBeenCalled();
    expect(
      mockWriteWorldEntitlementAndAttachToTeamAtomic
    ).not.toHaveBeenCalled();
  });

  it('blocks edit that changes identity into conflict before write', async () => {
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

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: 'ent-abc', // editing — would trigger identity-change move
      formState: makeFormState({ swapControllerPickId: 'MIA_2027_1st' }),
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('EXCLUSIVITY');
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
    expect(
      mockWriteWorldEntitlementAndAttachToTeamAtomic
    ).not.toHaveBeenCalled();
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
    expect(result.saveOperation).toBe('CREATE');
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
    expect(mockWriteWorldEntitlementAndAttachToTeamAtomic).toHaveBeenCalled();
    expect(mockRunLeagueClaimUniquenessGate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'ENTITLEMENT_SAVE',
        scopeMode: 'FULL_LEAGUE',
      })
    );
  });

  it('identity-changing edit uses duplicate-as-new and keeps original id untouched', async () => {
    mockGetEntitlementDeterministicId.mockReturnValue('ent:new:identity');

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: 'ent:original:id',
      formState: makeFormState({ swapControllerPickId: 'MIA_2027_1st' }),
    });

    expect(result.success).toBe(true);
    expect(result.saveOperation).toBe('DUPLICATE_AS_NEW');
    expect(result.createdNewEntitlement).toBe(true);
    expect(result.originalEntitlementId).toBe('ent:original:id');
    expect(result.entitlementId).toBe('ent:new:identity');
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
    expect(mockWriteWorldEntitlementAndAttachToTeamAtomic).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        worldId: 'test-world',
        entitlementId: 'ent:new:identity',
      })
    );
  });

  it('atomic create+attach failure returns failure and no fallback write', async () => {
    mockWriteWorldEntitlementAndAttachToTeamAtomic.mockResolvedValueOnce({
      success: false,
      error: 'transaction failed',
    });

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: undefined,
      formState: makeFormState(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('transaction failed');
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
    expect(mockWriteWorldEntitlementAndAttachToTeamAtomic).toHaveBeenCalled();
  });

  it('returns COLLISION error type when deterministic ID collision is detected', async () => {
    mockWriteWorldEntitlementAndAttachToTeamAtomic.mockResolvedValueOnce({
      success: false,
      errorType: 'ENTITLEMENT_ID_COLLISION',
      error:
        'Entitlement Create: ENTITLEMENT_ID_COLLISION for \"ent:det-id\" in world \"test-world\"',
    });

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: undefined,
      formState: makeFormState(),
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('COLLISION');
    expect(result.error).toContain('ENTITLEMENT_ID_COLLISION');
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
    expect(mockWriteWorldEntitlementAndAttachToTeamAtomic).toHaveBeenCalled();
  });

  it('blocks save when linked/residual references are missing', async () => {
    mockResolveEntitlement.mockResolvedValue(null);

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: undefined,
      formState: makeFormState({
        linkedEntitlementIdsText: 'ent:missing:1',
        residualOfEntitlementId: 'ent:missing:residual',
      }),
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('LINKAGE');
    expect(result.missingLinkedEntitlementIds).toContain('ent:missing:1');
    expect(result.missingResidualEntitlementId).toBe('ent:missing:residual');
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
    expect(
      mockWriteWorldEntitlementAndAttachToTeamAtomic
    ).not.toHaveBeenCalled();
  });

  it('blocks save when league claim uniqueness gate fails', async () => {
    mockRunLeagueClaimUniquenessGate.mockResolvedValue({
      ok: false,
      errorType: 'CLAIM_UNIQUENESS_VIOLATION',
      message:
        'Entitlement Save: Claim uniqueness violation — claim "own:LAL_2026_1st" is held by multiple teams.',
      conflicts: [
        {
          claimKey: 'own:LAL_2026_1st',
          claimType: 'pick_ownership',
          teams: ['BOS', 'LAL'],
          entitlements: [
            { teamCode: 'BOS', entitlementId: 'ent-bos' },
            { teamCode: 'LAL', entitlementId: 'det-id-001' },
          ],
        },
      ],
    });

    const result = await saveEntitlementFromFormState({
      storageMode: 'world',
      worldId: 'test-world',
      userId: 'test-user',
      entitlementId: undefined,
      formState: makeFormState({ kind: 'pick_ownership', underlyingPickId: 'LAL_2026_1st' }),
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('CLAIM_UNIQUENESS');
    expect(mockRunLeagueClaimUniquenessGate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'ENTITLEMENT_SAVE',
        scopeMode: 'FULL_LEAGUE',
      })
    );
    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
    expect(
      mockWriteWorldEntitlementAndAttachToTeamAtomic
    ).not.toHaveBeenCalled();
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
    expect(
      mockWriteWorldEntitlementAndAttachToTeamAtomic
    ).not.toHaveBeenCalled();
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
    expect(
      mockWriteWorldEntitlementAndAttachToTeamAtomic
    ).not.toHaveBeenCalled();
  });
});
