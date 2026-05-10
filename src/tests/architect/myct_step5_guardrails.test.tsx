// @vitest-environment jsdom
/**
 * FILE: src/tests/architect/myct_step5_guardrails.test.tsx
 * PURPOSE: Focused closeout guardrails for Multi-Year Cap Table Step 5.
 * OWNERSHIP: Feature: architect
 *
 * Protects:
 * - Dead-money manual replacement preserving source-grouped multi-season shape
 * - Exception modal owned current-season snapshot save semantics
 * - Replacement-vs-scope copy staying aligned with the modal edit boundary
 * - Current-season-only exception edit authority and Room eligibility gating
 */

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ManageDeadMoneyModal } from '@/features/architect/capSheet/modals/ManageDeadMoneyModal';
import { ManageExceptionsModal } from '@/features/architect/capSheet/modals/ManageExceptionsModal';
import { getCapSettingsForYear } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import { canUseRoomException } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modalHarness = vi.hoisted(() => ({
  capSettings: {
    salaryCap: 141_000_000,
    luxuryTax: 171_000_000,
    firstApron: 179_000_000,
    secondApron: 189_000_000,
    fullMLE: 12_800_000,
    taxpayerMLE: 5_000_000,
    bae: 4_700_000,
    roomMLE: 7_900_000,
    _meta: {
      source: 'test',
      warnings: [],
      seasonKey: '2025-26',
      resolved: true,
    },
  },
}));

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/capSettingsProvider',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/architect/utils/tradeMachine/utils/capSettingsProvider')
      >();

    return {
      ...actual,
      getCapSettingsForYear: vi.fn(() => modalHarness.capSettings),
    };
  }
);

vi.mock('@/features/architect/utils/capTotals/computeTeamCapTotals', () => ({
  canUseRoomException: vi.fn(() => ({
    eligible: true,
    reason: 'Under cap',
  })),
}));

const CURRENT_YEAR = 2026;
const CURRENT_SEASON = '2025-26';

const getRowByText = (text: string | RegExp) => {
  const row = within(screen.getByRole('table'))
    .getAllByRole('row')
    .find((candidate) => within(candidate).queryByText(text));

  expect(row).toBeDefined();
  return row as HTMLElement;
};

describe('MYCT Step 5 Guardrails - Source Scan', () => {
  const architectRoot = path.resolve(__dirname, '../../features/architect');
  const deadMoneyModalPath = path.join(
    architectRoot,
    'capSheet/modals/ManageDeadMoneyModal.tsx'
  );
  const exceptionsModalPath = path.join(
    architectRoot,
    'capSheet/modals/ManageExceptionsModal.tsx'
  );
  const capSheetPath = path.join(
    architectRoot,
    'capSheet/CapSheet/CapSheet.tsx'
  );

  it('keeps dead-money replacement grouped by original source and the warning copy explicit', () => {
    const source = fs.readFileSync(deadMoneyModalPath, 'utf-8');

    expect(source).toContain('const buildDeadCapReplacementPayload =');
    expect(source).toContain('sourceGroupKey?: string;');
    expect(source).toContain('const sourceGroupKey = `dead-cap-source-${entryIndex}`;');
    expect(source).toContain(
      'const groupKey = entry.sourceGroupKey || `manual-row-${entry.id}`;'
    );
    expect(source).toContain('payloadEntry.originalSalary = toDeadCapAmount');
    expect(source).toContain('payloadEntry.waiveDate = originalEntry.waiveDate;');
    expect(source).toContain("notes: originalEntry?.notes || 'Manual Adjustment'");
    expect(source).toContain(
      "replace the team's entire dead money ledger"
    );
    expect(source).toContain(
      'canonical multi-season dead-cap entry; unrelated manual rows stay distinct.'
    );
    expect(source).not.toContain(
      'creating one DeadCapEntry per row is safest to avoid accidental merging'
    );
  });

  it('keeps exception saves routed through the owned current-season snapshot builder', () => {
    const source = fs.readFileSync(exceptionsModalPath, 'utf-8');

    expect(source).toContain('const buildOwnedCurrentSeasonExceptionsSnapshot =');
    expect(source).toContain('const buildOwnedCurrentSeasonExceptionEntry =');
    expect(source).toContain(
      'const shouldPersistOwnedCurrentSeasonException ='
    );
    expect(source).toContain('seasonKey: currentSeasonKey');
    expect(source).toContain(
      'Omission is the explicit clear signal for this owned current-season'
    );
    expect(source).toContain(
      'non-editable buckets such as TPE/DPE'
    );
    expect(source).toContain('disabledExceptionTypes: DisabledExceptionTypes');
    expect(source).toContain(
      'disabled UI state cannot save as enabled'
    );
    expect(source).toContain(
      "will update the team's live current-season exception state"
    );
    expect(source).toContain(
      'Future-year Cap Sheet views are read-only for'
    );
    expect(source).not.toContain('existing.seasonKey ?? seasonKey');
  });

  it('keeps future-year exception edit authority fenced at the CapSheet handoff', () => {
    const source = fs.readFileSync(capSheetPath, 'utf-8');

    expect(source).toContain(
      'const isViewingCurrentYear = selectedYear === currentYear;'
    );
    expect(source).toMatch(
      /const\s+canManageExceptions\s*=[\s\S]*hasManualCapSheetMutationAuthority\s*&&\s*isViewingCurrentYear/
    );
    expect(source).toContain('showExceptionsModal && !isViewingCurrentYear');
    expect(source).toContain(
      'cap-sheet-future-year-exception-edit-boundary'
    );
    expect(source).toContain(
      'future-year exception authority.'
    );
    expect(source).toMatch(
      /<ManageExceptionsModal[\s\S]*currentYear=\{currentYear\}/
    );
    expect(source).not.toMatch(
      /<ManageExceptionsModal[\s\S]*currentYear=\{selectedYear\}/
    );
  });
});

describe('MYCT Step 5 Guardrails - Dead-Money Shape Preservation', () => {
  afterEach(() => {
    cleanup();
  });

  it('saves one canonical multi-season entry for rows from the same source and preserves metadata', async () => {
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <ManageDeadMoneyModal
        isOpen
        onClose={() => {}}
        onSave={onSave}
        currentYear={CURRENT_YEAR}
        teamCapSheet={{
          deadCap: [
            {
              playerId: 'dead-source-1',
              playerName: 'Grouped Stretch',
              originalSalary: '9000000',
              waiveDate: '2025-07-01',
              notes: 'Original grouped ledger',
              stretched: true,
              amountByYear: [
                { season: CURRENT_SEASON, amount: 3_000_000 },
                { season: '2026-27', amount: 2_500_000, isStretched: true },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/Manual Override Mode:/).closest('div')).toHaveTextContent(
      "replace the team's entire dead money ledger"
    );

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith([
      {
        playerId: 'dead-source-1',
        playerName: 'Grouped Stretch',
        originalSalary: 9_000_000,
        amountByYear: [
          {
            season: CURRENT_SEASON,
            amount: 3_000_000,
            isStretched: true,
          },
          {
            season: '2026-27',
            amount: 2_500_000,
            isStretched: true,
          },
        ],
        waiveDate: '2025-07-01',
        notes: 'Original grouped ledger',
      },
    ]);
  });

  it('keeps manually added rows separate even when labels and seasons match', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const dateNow = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_001)
      .mockReturnValueOnce(1_002);

    try {
      render(
        <ManageDeadMoneyModal
          isOpen
          onClose={() => {}}
          onSave={onSave}
          currentYear={CURRENT_YEAR}
          teamCapSheet={{ deadCap: [] }}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /add entry/i }));
      fireEvent.click(screen.getByRole('button', { name: /add entry/i }));

      const textboxes = screen.getAllByRole('textbox');
      const amountInputs = screen.getAllByRole('spinbutton');

      fireEvent.change(textboxes[0], { target: { value: 'Same Manual Row' } });
      fireEvent.change(textboxes[1], { target: { value: CURRENT_SEASON } });
      fireEvent.change(textboxes[2], { target: { value: 'Same Manual Row' } });
      fireEvent.change(textboxes[3], { target: { value: CURRENT_SEASON } });
      fireEvent.change(amountInputs[0], { target: { value: '1000000' } });
      fireEvent.change(amountInputs[1], { target: { value: '2000000' } });

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });

      const payload = onSave.mock.calls[0][0];

      expect(payload).toHaveLength(2);
      expect(payload).toEqual([
        expect.objectContaining({
          playerName: 'Same Manual Row',
          amountByYear: [
            {
              season: CURRENT_SEASON,
              amount: 1_000_000,
              isStretched: false,
            },
          ],
        }),
        expect.objectContaining({
          playerName: 'Same Manual Row',
          amountByYear: [
            {
              season: CURRENT_SEASON,
              amount: 2_000_000,
              isStretched: false,
            },
          ],
        }),
      ]);
    } finally {
      dateNow.mockRestore();
    }
  });
});

describe('MYCT Step 5 Guardrails - Exception Save Semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi
      .mocked(getCapSettingsForYear)
      .mockReturnValue(modalHarness.capSettings as ReturnType<typeof getCapSettingsForYear>);
    vi.mocked(canUseRoomException).mockReturnValue({
      eligible: true,
      reason: 'Under cap',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('saves canonical current-season exception state and omits disabled zero-usage owned buckets as clears', async () => {
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <ManageExceptionsModal
        isOpen
        onClose={() => {}}
        onSave={onSave}
        currentYear={CURRENT_YEAR}
        teamCapSheet={{
          exceptions: {
            mle: {
              enabled: true,
              totalAmount: '6000000',
              usedAmount: '2000000',
              seasonKey: '2024-25',
              notes: '  active MLE  ',
            },
            tpmle: {
              enabled: false,
              totalAmount: 5_000_000,
              usedAmount: 0,
              seasonKey: '2024-25',
            },
            bae: {
              enabled: false,
              totalAmount: 4_700_000,
              usedAmount: 1_000_000,
              seasonKey: '2024-25',
              notes: 'carry usage',
            },
            room: {
              enabled: false,
              totalAmount: 7_900_000,
              usedAmount: 0,
              seasonKey: '2024-25',
            },
            dpe: {
              enabled: true,
              totalAmount: 3_000_000,
            },
            tpe: [{ id: 'tpe-preserved-downstream', totalAmount: 4_000_000 }],
          },
        }}
      />
    );

    expect(screen.getByText(/Exception Management:/).closest('div')).toHaveTextContent(
      "live current-season exception state (2025-26)"
    );
    expect(screen.getByText(/Exception Management:/).closest('div')).toHaveTextContent(
      'Future-year Cap Sheet views are read-only for exception editing'
    );

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0];

    expect(payload).toEqual({
      mle: {
        type: 'mle',
        enabled: true,
        available: true,
        totalAmount: 6_000_000,
        maxAmount: 6_000_000,
        amount: 6_000_000,
        usedAmount: 2_000_000,
        remainingAmount: 4_000_000,
        seasonKey: CURRENT_SEASON,
        notes: 'active MLE',
      },
      bae: {
        type: 'bae',
        enabled: false,
        available: false,
        totalAmount: 4_700_000,
        maxAmount: 4_700_000,
        amount: 4_700_000,
        usedAmount: 1_000_000,
        remainingAmount: 3_700_000,
        seasonKey: CURRENT_SEASON,
        notes: 'carry usage',
      },
    });
    expect(payload).not.toHaveProperty('tpmle');
    expect(payload).not.toHaveProperty('room');
    expect(payload).not.toHaveProperty('dpe');
    expect(payload).not.toHaveProperty('tpe');
  });

  it('keeps Room exception eligibility gating aligned with saved state', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    vi.mocked(canUseRoomException).mockReturnValue({
      eligible: false,
      reason: 'Over cap',
    });

    render(
      <ManageExceptionsModal
        isOpen
        onClose={() => {}}
        onSave={onSave}
        currentYear={CURRENT_YEAR}
        teamCapSheet={{
          exceptions: {
            room: {
              enabled: true,
              totalAmount: 7_900_000,
              usedAmount: 2_000_000,
              seasonKey: CURRENT_SEASON,
            },
          },
        }}
      />
    );

    const roomRow = getRowByText('Room Exception');
    const roomCheckbox = within(roomRow).getByRole('checkbox');

    expect(roomRow).toHaveTextContent(
      'Only available to teams under the salary cap'
    );
    expect(roomCheckbox).toBeDisabled();
    expect(roomCheckbox).not.toBeChecked();

    fireEvent.click(roomCheckbox);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave.mock.calls[0][0]).not.toHaveProperty('room');
  });
});
