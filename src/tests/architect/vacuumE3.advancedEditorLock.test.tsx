/**
 * FILE: src/tests/architect/vacuumE3.advancedEditorLock.test.tsx
 * PURPOSE: TM-VACUUM-E3 — Advanced Editor identity lock parity in edit mode.
 *
 * HISTORY:
 *  - 2026-02-12: Created for TM-VACUUM-E3 lock parity validation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EntitlementEditorAdvancedTab } from '@/features/architect/admin/EntitlementEditorAdvancedTab';
import type { EntitlementFormState } from '@/features/architect/admin/entitlementEditorFormState';

afterEach(cleanup);

const baseFormState: EntitlementFormState = {
  id: 'ent:BOS:2027:1:own:abc',
  holderTeam: 'BOS',
  seasonYear: '2027',
  round: '1',
  kind: 'pick_ownership',
  description: 'Test pick',
  underlyingPickId: 'pick:BOS:2027:1',
  underlyingStatus: 'clean',
  swapControllerPickId: '',
  swapTargetDefinition: '',
  swapType: '',
  poolUnderlyingPickIdsText: '',
  receivesComparator: '',
  receivesRankText: '',
  protectionLadder: [],
  linkedEntitlementIdsText: '',
  residualOfEntitlementId: '',
  coveredByEntitlementIdsText: '',
};

describe('EntitlementEditorAdvancedTab — edit mode lock parity', () => {
  it('shows identity lock warning in edit mode', () => {
    const { container } = render(
      <EntitlementEditorAdvancedTab
        formState={baseFormState}
        onApplyJson={vi.fn(() => ({ success: true }))}
        isEditMode={true}
      />
    );

    const warningDivs = container.querySelectorAll('.text-amber-300');
    expect(warningDivs.length).toBe(1);
    expect(warningDivs[0].textContent).toContain(
      'Identity fields are locked in edit mode'
    );
    expect(warningDivs[0].textContent).toContain('Duplicate as new');
  });

  it('does NOT show identity lock warning in create mode', () => {
    const { container } = render(
      <EntitlementEditorAdvancedTab
        formState={baseFormState}
        onApplyJson={vi.fn(() => ({ success: true }))}
        isEditMode={false}
      />
    );

    const warningDivs = container.querySelectorAll('.text-amber-300');
    expect(warningDivs.length).toBe(0);
  });

  it('allows identity field JSON edits and surfaces duplicate-as-new notice in edit mode', () => {
    const onApplyJson = vi.fn((_json: string) => ({ success: true }));
    const { container, getByText } = render(
      <EntitlementEditorAdvancedTab
        formState={baseFormState}
        onApplyJson={onApplyJson}
        isEditMode={true}
      />
    );

    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();

    const modified = JSON.stringify(
      { ...baseFormState, holderTeam: 'LAL' },
      null,
      2
    );
    expect(textarea).not.toBeNull();
    fireEvent.change(textarea!, { target: { value: modified } });
    fireEvent.click(screen.getByText('Apply JSON'));

    expect(onApplyJson).toHaveBeenCalled();
    const appliedJson = JSON.parse(onApplyJson.mock.calls[0][0]);
    expect(appliedJson.holderTeam).toBe('LAL');
    expect(
      getByText(/This change requires creating a new entitlement/i)
    ).toBeInTheDocument();
  });

  it('allows non-identity field changes in edit mode', () => {
    const onApplyJson = vi.fn((_json: string) => ({ success: true }));
    const { container } = render(
      <EntitlementEditorAdvancedTab
        formState={baseFormState}
        onApplyJson={onApplyJson}
        isEditMode={true}
      />
    );

    const textarea = container.querySelector('textarea');
    const modified = JSON.stringify(
      { ...baseFormState, description: 'New description' },
      null,
      2
    );
    expect(textarea).not.toBeNull();
    fireEvent.change(textarea!, { target: { value: modified } });
    fireEvent.click(screen.getByText('Apply JSON'));

    expect(onApplyJson).toHaveBeenCalled();
    const appliedJson = JSON.parse(onApplyJson.mock.calls[0][0]);
    expect(appliedJson.description).toBe('New description');
  });

  it('allows all field changes in create mode', () => {
    const onApplyJson = vi.fn((_json: string) => ({ success: true }));
    const { container } = render(
      <EntitlementEditorAdvancedTab
        formState={baseFormState}
        onApplyJson={onApplyJson}
        isEditMode={false}
      />
    );

    const textarea = container.querySelector('textarea');
    const modified = JSON.stringify(
      { ...baseFormState, holderTeam: 'LAL', kind: 'swap_right' },
      null,
      2
    );
    expect(textarea).not.toBeNull();
    fireEvent.change(textarea!, { target: { value: modified } });
    fireEvent.click(screen.getByText('Apply JSON'));

    expect(onApplyJson).toHaveBeenCalled();
    const appliedJson = JSON.parse(onApplyJson.mock.calls[0][0]);
    expect(appliedJson.holderTeam).toBe('LAL');
    expect(appliedJson.kind).toBe('swap_right');
  });
});
