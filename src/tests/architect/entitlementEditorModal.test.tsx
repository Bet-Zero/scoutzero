/**
 * FILE: src/tests/architect/entitlementEditorModal.test.tsx
 * PURPOSE: Tests for EntitlementEditorModal save + validation behavior.
 * OWNERSHIP: Test suite
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EntitlementEditorModal } from '@/features/architect/admin/EntitlementEditorModal';

const mockWriteWorldEntitlement = vi.fn();

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('@/features/architect/utils/entitlements/entitlementWriter', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/architect/utils/entitlements/entitlementWriter')
  >('@/features/architect/utils/entitlements/entitlementWriter');
  return {
    ...actual,
    writeWorldEntitlement: (...args: unknown[]) => mockWriteWorldEntitlement(...args),
    attachEntitlementToTeam: vi.fn(),
    detachEntitlementFromTeam: vi.fn(),
    isEntitlementAuthoringEnabled: () => true,
  };
});

const defaultProps = {
  worldId: 'world-123',
  entitlementId: 'ent:LAL:2026:1:own:abcd',
  userId: 'user-1',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

const setBasicFields = () => {
  fireEvent.change(screen.getByLabelText(/underlying pick id/i), {
    target: { value: 'LAL_2026_1st' },
  });
};

describe('EntitlementEditorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteWorldEntitlement.mockResolvedValue({
      success: true,
      path: 'architect_worlds/world-123/entitlements/ent:LAL:2026:1:own:abcd',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('saves a protection ladder tier and calls writer', async () => {
    render(<EntitlementEditorModal {...defaultProps} />);

    setBasicFields();

    const [protectionTab] = screen.getAllByRole('button', { name: /Protection Ladder/i });
    fireEvent.click(protectionTab);
    fireEvent.click(screen.getByRole('button', { name: /Add Tier/i }));

    fireEvent.change(screen.getByLabelText(/^Year$/i), {
      target: { value: '2026' },
    });
    fireEvent.change(screen.getByLabelText(/^Condition$/i), {
      target: { value: 'Top 3' },
    });
    fireEvent.change(screen.getByLabelText(/^If Triggered$/i), {
      target: { value: 'roll' },
    });
    fireEvent.change(screen.getByLabelText(/^Roll To Year$/i), {
      target: { value: '2027' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Entitlement/i }));

    await waitFor(() => {
      expect(mockWriteWorldEntitlement).toHaveBeenCalled();
    });

    const call = mockWriteWorldEntitlement.mock.calls[0][1];
    expect(call.document.protectionLadder).toEqual([
      {
        year: 2026,
        condition: 'Top 3',
        ifTriggered: 'roll',
        rollToYear: 2027,
        convertToRound: undefined,
      },
    ]);
    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });

  it('blocks save when protection ladder is invalid', async () => {
    render(<EntitlementEditorModal {...defaultProps} />);

    setBasicFields();

    const [protectionTab] = screen.getAllByRole('button', { name: /Protection Ladder/i });
    fireEvent.click(protectionTab);
    fireEvent.click(screen.getByRole('button', { name: /Add Tier/i }));

    fireEvent.change(screen.getByLabelText(/^Year$/i), {
      target: { value: '2026' },
    });
    fireEvent.change(screen.getByLabelText(/^Condition$/i), {
      target: { value: 'Top 3' },
    });
    fireEvent.change(screen.getByLabelText(/^If Triggered$/i), {
      target: { value: 'roll' },
    });

    // Save button should be disabled when form has validation errors
    const saveButton = screen.getByRole('button', { name: /Save Entitlement/i });
    expect(saveButton).toBeDisabled();

    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
  });

  describe('TM-6: Edit flow with initial document', () => {
    it('populates form with initialDocument fields', () => {
      const initialDocument = {
        id: 'ent:LAL:2028:1:own:existing',
        holderTeam: 'LAL',
        seasonYear: 2028,
        round: 1,
        kind: 'pick_ownership',
        underlyingPickId: 'LAL_2028_1st',
        underlyingStatus: 'clean',
        protectionLadder: [
          { year: 2028, condition: 'Top 5', ifTriggered: 'roll', rollToYear: 2029 },
        ],
      };

      render(
        <EntitlementEditorModal
          {...defaultProps}
          initialDocument={initialDocument}
        />
      );

      // Verify form populates with initial document values
      expect(screen.getByLabelText(/underlying pick id/i)).toHaveValue('LAL_2028_1st');
    });

    it('onSuccess receives entitlementId and updated document', async () => {
      const onSuccess = vi.fn();
      const initialDocument = {
        id: 'ent:LAL:2027:1:own:update',
        holderTeam: 'LAL',
        seasonYear: 2027,
        round: 1,
        kind: 'pick_ownership',
        underlyingPickId: 'LAL_2027_1st',
      };

      render(
        <EntitlementEditorModal
          {...defaultProps}
          initialDocument={initialDocument}
          entitlementId={initialDocument.id}
          onSuccess={onSuccess}
        />
      );

      // Add a protection tier
      const [protectionTab] = screen.getAllByRole('button', { name: /Protection Ladder/i });
      fireEvent.click(protectionTab);
      fireEvent.click(screen.getByRole('button', { name: /Add Tier/i }));

      fireEvent.change(screen.getByLabelText(/^Year$/i), {
        target: { value: '2027' },
      });
      fireEvent.change(screen.getByLabelText(/^Condition$/i), {
        target: { value: 'Top 10' },
      });
      fireEvent.change(screen.getByLabelText(/^If Triggered$/i), {
        target: { value: 'roll' },
      });
      fireEvent.change(screen.getByLabelText(/^Roll To Year$/i), {
        target: { value: '2028' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Save Entitlement/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      // Verify onSuccess receives the entitlementId and updated document
      // Note: onSuccess is called with a single object { entitlementId, document }
      const callArg = onSuccess.mock.calls[0][0];
      expect(callArg.entitlementId).toBe('ent:LAL:2027:1:own:update');
      expect(callArg.document.protectionLadder).toHaveLength(1);
      expect(callArg.document.protectionLadder[0].condition).toBe('Top 10');
    });

    it('persists swap fields correctly', async () => {
      const initialDocument = {
        id: 'ent:BOS:2029:1:swap:test',
        holderTeam: 'BOS',
        seasonYear: 2029,
        round: 1,
        kind: 'swap_right',
        swapControllerPickId: 'BOS_2029_1st',
        swapTargetDefinition: '',
      };

      render(
        <EntitlementEditorModal
          {...defaultProps}
          initialDocument={initialDocument}
          entitlementId={initialDocument.id}
        />
      );

      // Go to swap tab and fill in target definition
      const [swapTab] = screen.getAllByRole('button', { name: /Swap/i });
      fireEvent.click(swapTab);

      fireEvent.change(screen.getByLabelText(/Swap Target Definition/i), {
        target: { value: 'Option to swap with PHI 2029 1st' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Save Entitlement/i }));

      await waitFor(() => {
        expect(mockWriteWorldEntitlement).toHaveBeenCalled();
      });

      const call = mockWriteWorldEntitlement.mock.calls[0][1];
      expect(call.document.swapTargetDefinition).toBe('Option to swap with PHI 2029 1st');
    });
  });
});
