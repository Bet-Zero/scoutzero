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

    fireEvent.click(screen.getByRole('button', { name: /Save Entitlement/i }));

    await waitFor(() => {
      expect(screen.getByTestId('entitlement-errors')).toBeInTheDocument();
    });

    expect(mockWriteWorldEntitlement).not.toHaveBeenCalled();
  });
});
