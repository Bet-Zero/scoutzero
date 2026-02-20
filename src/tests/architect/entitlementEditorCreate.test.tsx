/**
 * FILE: src/tests/architect/entitlementEditorCreate.test.tsx
 * PURPOSE: Tests for TM-7 create entitlement flow (null entitlementId = create mode).
 * OWNERSHIP: Test suite (TM-7)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EntitlementEditorCreateButton } from '@/features/architect/admin/EntitlementEditorCreateButton';
import {
  createEntitlementFormState,
  buildEntitlementDocument,
} from '@/features/architect/admin/entitlementEditorFormState';

describe('TM-7: EntitlementEditorCreateButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a button with "New Entitlement" text', () => {
    render(<EntitlementEditorCreateButton onClick={() => {}} />);
    expect(
      screen.getByRole('button', { name: /New Entitlement/i })
    ).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<EntitlementEditorCreateButton onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button', { name: /New Entitlement/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<EntitlementEditorCreateButton onClick={() => {}} disabled />);
    expect(
      screen.getByRole('button', { name: /New Entitlement/i })
    ).toBeDisabled();
  });

  it('supports sm and md size variants', () => {
    const { rerender } = render(
      <EntitlementEditorCreateButton onClick={() => {}} size="sm" />
    );
    let button = screen.getByRole('button', { name: /New Entitlement/i });
    expect(button.className).toContain('text-xs');

    rerender(<EntitlementEditorCreateButton onClick={() => {}} size="md" />);
    button = screen.getByRole('button', { name: /New Entitlement/i });
    expect(button.className).toContain('text-sm');
  });
});

describe('TM-7: Create mode form defaults', () => {
  it('creates form state with defaults for new entitlement', () => {
    const formState = createEntitlementFormState({
      holderTeam: 'ATL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership',
    });

    expect(formState.holderTeam).toBe('ATL');
    expect(formState.seasonYear).toBe('2026');
    expect(formState.round).toBe('1');
    expect(formState.kind).toBe('pick_ownership');
    expect(formState.id).toBe('');
    expect(formState.protectionLadder).toHaveLength(0);
    expect(formState.swapType).toBe('');
  });

  it('creates form state without initialDocument (full defaults)', () => {
    const formState = createEntitlementFormState();
    expect(formState.holderTeam).toBe('LAL');
    expect(formState.seasonYear).toBe('2026');
    expect(formState.kind).toBe('pick_ownership');
  });

  it('build document from minimal create-mode form state', () => {
    const formState = createEntitlementFormState({
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'pick_ownership',
    });
    formState.underlyingPickId = 'BOS_2027_1st';

    const doc = buildEntitlementDocument(formState);
    expect(doc.holderTeam).toBe('BOS');
    expect(doc.seasonYear).toBe(2027);
    expect(doc.round).toBe(1);
    expect(doc.kind).toBe('pick_ownership');
    expect(doc.underlyingPickId).toBe('BOS_2027_1st');
  });
});
