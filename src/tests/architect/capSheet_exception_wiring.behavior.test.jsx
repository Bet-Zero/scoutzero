import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ExceptionTracker from '@/features/architect/capSheet/ExceptionTracker/ExceptionTracker';
import ManageExceptionsModal from '@/features/architect/capSheet/modals/ManageExceptionsModal';
import ManageDeadMoneyModal from '@/features/architect/capSheet/modals/ManageDeadMoneyModal';
import {
  getCapSettingsForYear,
  getExceptionDefaultAmountFromCapSettings,
} from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import { canUseRoomException } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

const hoistedMocks = vi.hoisted(() => ({
  tpeList: [],
  buildCapSettings: (overrides = {}) => ({
    salaryCap: 141_000_000,
    firstApron: 179_000_000,
    secondApron: 189_000_000,
    luxuryTax: 171_000_000,
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
    ...overrides,
  }),
}));

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/capSettingsProvider',
  async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      getCapSettingsForYear: vi.fn(() => hoistedMocks.buildCapSettings()),
    };
  }
);

vi.mock('@/features/architect/utils/capTotals/computeTeamCapTotals', () => ({
  canUseRoomException: vi.fn(() => ({ eligible: true })),
}));

vi.mock('@/features/architect/utils/persistenceContracts/normalizeTeamTpe', () => ({
  getTeamTpeList: vi.fn(() => hoistedMocks.tpeList),
}));

function normalizedTexts(elements) {
  return elements.map((element) =>
    element.textContent?.replace(/\s+/g, ' ').trim() || ''
  );
}

function expectBefore(first, second) {
  expect(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  ).not.toBe(0);
}

describe('Cap Sheet Exception Wiring (E1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoistedMocks.tpeList = [];
    vi
      .mocked(getCapSettingsForYear)
      .mockReturnValue(hoistedMocks.buildCapSettings());
    vi.mocked(canUseRoomException).mockReturnValue({ eligible: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('reads exception defaults from normalized cap-settings keys only', () => {
    const normalizedCapSettings = hoistedMocks.buildCapSettings({
      fullMLE: 11_111_111,
      taxpayerMLE: 2_222_222,
      bae: 3_333_333,
      roomMLE: 4_444_444,
      nonTaxMLE: 91_000_000,
      mle: 92_000_000,
      taxMLE: 93_000_000,
      tpmle: 94_000_000,
      room: 95_000_000,
    });

    expect(
      getExceptionDefaultAmountFromCapSettings('mle', normalizedCapSettings)
    ).toBe(11_111_111);
    expect(
      getExceptionDefaultAmountFromCapSettings('tpmle', normalizedCapSettings)
    ).toBe(2_222_222);
    expect(
      getExceptionDefaultAmountFromCapSettings('bae', normalizedCapSettings)
    ).toBe(3_333_333);
    expect(
      getExceptionDefaultAmountFromCapSettings('room', normalizedCapSettings)
    ).toBe(4_444_444);

    expect(
      getExceptionDefaultAmountFromCapSettings('mle', {
        nonTaxMLE: 91_000_000,
        mle: 92_000_000,
      })
    ).toBe(0);
    expect(
      getExceptionDefaultAmountFromCapSettings('tpmle', {
        taxMLE: 93_000_000,
        tpmle: 94_000_000,
      })
    ).toBe(0);
    expect(
      getExceptionDefaultAmountFromCapSettings('room', {
        room: 95_000_000,
      })
    ).toBe(0);
    expect(getExceptionDefaultAmountFromCapSettings('bae', { bae: 3_333_333 })).toBe(
      3_333_333
    );
  });

  it('shares the same normalized season defaults across tracker and modal surfaces', () => {
    vi.mocked(getCapSettingsForYear).mockReturnValue(
      hoistedMocks.buildCapSettings({
        fullMLE: 11_111_111,
        taxpayerMLE: 2_222_222,
        bae: 3_333_333,
        roomMLE: 4_444_444,
      })
    );

    render(
      <>
        <ExceptionTracker
          teamCapSheet={{ hardCapped: 0, exceptions: {} }}
          currentYear={2026}
        />
        <ManageExceptionsModal
          isOpen
          onClose={() => {}}
          onSave={vi.fn()}
          currentYear={2026}
          teamCapSheet={{ exceptions: {} }}
        />
      </>
    );

    const trackerSection = screen.getByLabelText(
      'Cap sheet adjacent exception presentation surface'
    );
    expect(within(trackerSection).getByText('$11,111,111')).toBeInTheDocument();
    expect(within(trackerSection).getByText('$2,222,222')).toBeInTheDocument();
    expect(within(trackerSection).getByText('$3,333,333')).toBeInTheDocument();
    expect(within(trackerSection).getByText('$4,444,444')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const findExceptionRow = (label) =>
      within(table)
        .getAllByRole('row')
        .find((row) => within(row).queryByText(label));

    expect(
      within(findExceptionRow('Mid-Level Exception (MLE)')).getByDisplayValue(
        '11111111'
      )
    ).toBeInTheDocument();
    expect(
      within(findExceptionRow('Taxpayer MLE')).getByDisplayValue('2222222')
    ).toBeInTheDocument();
    expect(
      within(findExceptionRow('Bi-Annual Exception (BAE)')).getByDisplayValue(
        '3333333'
      )
    ).toBeInTheDocument();
    expect(
      within(findExceptionRow('Room Exception')).getByDisplayValue('4444444')
    ).toBeInTheDocument();
  });

  it('updates ExceptionTracker cards after modal save in the same page session', async () => {
    const ExceptionSaveHarness = () => {
      const [teamCapSheet, setTeamCapSheet] = React.useState({
        hardCapped: 0,
        exceptions: {},
        mle: {
          amount: 9_876_543,
          used: 111_111,
        },
      });

      const handleSave = async () => {
        setTeamCapSheet((prev) => ({
          ...prev,
          exceptions: {
            ...(prev.exceptions || {}),
            mle: {
              enabled: true,
              totalAmount: 9_876_543,
              usedAmount: 1_234_567,
            },
          },
        }));
        return true;
      };

      return (
        <>
          <ExceptionTracker teamCapSheet={teamCapSheet} currentYear={2026} />
          <ManageExceptionsModal
            isOpen
            onClose={() => {}}
            teamCapSheet={teamCapSheet}
            onSave={handleSave}
            currentYear={2026}
          />
        </>
      );
    };

    render(<ExceptionSaveHarness />);

    expect(screen.getByText('$9,765,432')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByText('$9,765,432')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('$8,641,976').length).toBeGreaterThan(0);
  });

  it('keeps ROOM unavailable across tracker and modal when under-cap eligibility is false and only defaults exist', () => {
    vi.mocked(canUseRoomException).mockReturnValue({
      eligible: false,
      reason: 'Over cap',
    });
    vi.mocked(getCapSettingsForYear).mockReturnValue(
      hoistedMocks.buildCapSettings({
        roomMLE: 4_444_444,
      })
    );

    render(
      <>
        <ExceptionTracker
          teamCapSheet={{ hardCapped: 0, exceptions: {} }}
          currentYear={2026}
        />
        <ManageExceptionsModal
          isOpen
          onClose={() => {}}
          onSave={vi.fn()}
          currentYear={2026}
          teamCapSheet={{ exceptions: {} }}
        />
      </>
    );

    const trackerSection = screen.getByLabelText(
      'Cap sheet adjacent exception presentation surface'
    );
    const roomCard = within(trackerSection).getByText('ROOM').closest('div.relative');
    expect(roomCard).not.toBeNull();
    expect(within(roomCard).getByText('$0')).toBeInTheDocument();
    expect(within(roomCard).getByText('N/A')).toBeInTheDocument();
    expect(within(trackerSection).queryByText('$4,444,444')).not.toBeInTheDocument();

    const table = screen.getByRole('table');
    const roomRow = within(table)
      .getAllByRole('row')
      .find((row) => within(row).queryByText('Room Exception'));
    expect(roomRow).toBeDefined();
    expect(roomRow).toHaveTextContent(
      'Only available to teams under the salary cap'
    );
    expect(within(roomRow).getByRole('checkbox')).toBeDisabled();
  });

  it('keeps ROOM unavailable across tracker and modal when stored room data exists but eligibility is false', () => {
    vi.mocked(canUseRoomException).mockReturnValue({
      eligible: false,
      reason: 'Over cap',
    });

    render(
      <>
        <ExceptionTracker
          teamCapSheet={{
            hardCapped: 0,
            exceptions: {
              room: {
                enabled: true,
                totalAmount: 7_900_000,
                usedAmount: 2_000_000,
                remainingAmount: 5_900_000,
              },
            },
          }}
          currentYear={2026}
        />
        <ManageExceptionsModal
          isOpen
          onClose={() => {}}
          onSave={vi.fn()}
          currentYear={2026}
          teamCapSheet={{
            exceptions: {
              room: {
                enabled: true,
                totalAmount: 7_900_000,
                usedAmount: 2_000_000,
                seasonKey: '2025-26',
              },
            },
          }}
        />
      </>
    );

    const trackerSection = screen.getByLabelText(
      'Cap sheet adjacent exception presentation surface'
    );
    const roomCard = within(trackerSection).getByText('ROOM').closest('div.relative');
    expect(roomCard).not.toBeNull();
    expect(within(roomCard).getByText('$0')).toBeInTheDocument();
    expect(within(roomCard).getByText('N/A')).toBeInTheDocument();
    expect(within(trackerSection).queryByText('$5,900,000')).not.toBeInTheDocument();

    const table = screen.getByRole('table');
    const roomRow = within(table)
      .getAllByRole('row')
      .find((row) => within(row).queryByText('Room Exception'));
    expect(roomRow).toBeDefined();
    expect(roomRow).toHaveTextContent(
      'Only available to teams under the salary cap'
    );
    expect(within(roomRow).getByRole('checkbox')).toBeDisabled();
  });

  it('renders structured hard-cap level and reason from the canonical resolver in ExceptionTracker', () => {
    render(
      <ExceptionTracker
        teamCapSheet={{
          exceptions: {},
          hardCapSecondApron: {
            active: true,
            reason: 'Structured second-apron trigger',
          },
        }}
        currentYear={2026}
      />
    );

    const trackerSection = screen.getByLabelText(
      'Cap sheet adjacent exception presentation surface'
    );

    expect(within(trackerSection).getByText('Hard Capped')).toBeInTheDocument();
    expect(within(trackerSection).getByText('2nd Apron')).toBeInTheDocument();
    expect(
      within(trackerSection).getByText('Structured second-apron trigger')
    ).toBeInTheDocument();
    expect(within(trackerSection).getByText('$189,000,000')).toBeInTheDocument();
  });

  it('renders legacy ambiguous hard-cap state through the canonical resolver fail-closed path', () => {
    render(
      <ExceptionTracker
        teamCapSheet={{
          hardCapped: true,
          exceptions: {},
        }}
        currentYear={2026}
      />
    );

    const trackerSection = screen.getByLabelText(
      'Cap sheet adjacent exception presentation surface'
    );

    expect(within(trackerSection).getByText('Hard Capped')).toBeInTheDocument();
    expect(
      within(trackerSection).getByText('1st Apron (fail-closed)')
    ).toBeInTheDocument();
    expect(
      within(trackerSection).getByText(
        'Hard cap indicated by legacy/ambiguous value. Applying fail-closed ceiling.'
      )
    ).toBeInTheDocument();
  });

  it('uses the shared resolver for legacy MLE hard-cap compatibility instead of tracker-local copy', () => {
    render(
      <ExceptionTracker
        teamCapSheet={{
          mle: {
            amount: 11_111_111,
            used: 2_500_000,
          },
        }}
        currentYear={2026}
      />
    );

    const trackerSection = screen.getByLabelText(
      'Cap sheet adjacent exception presentation surface'
    );

    expect(within(trackerSection).getByText('Hard Capped')).toBeInTheDocument();
    expect(within(trackerSection).getByText('1st Apron')).toBeInTheDocument();
    expect(
      within(trackerSection).getByText(
        'Hard cap triggered at First Apron via Non-Taxpayer MLE usage.'
      )
    ).toBeInTheDocument();
    expect(
      within(trackerSection).queryByText(
        'Hard capped at 1st Apron due to usage of Non-Taxpayer MLE or BAE.'
      )
    ).not.toBeInTheDocument();
  });

  it('does not render or persist unsupported DPE exception key', async () => {
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <ManageExceptionsModal
        isOpen
        onClose={() => {}}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{
          exceptions: {
            dpe: {
              enabled: true,
              totalAmount: 3_000_000,
              usedAmount: 1_000_000,
            },
            mle: {
              enabled: true,
              totalAmount: 6_000_000,
              usedAmount: 2_000_000,
            },
          },
        }}
      />
    );

    expect(
      screen.queryByText(/Disabled Player Exception \(DPE\)/i)
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const savedPayload = onSave.mock.calls[0][0];
    expect(savedPayload).toHaveProperty('mle');
    expect(savedPayload).not.toHaveProperty('dpe');
  });

  it('preserves ManageExceptionsModal visible row order, button order, and payload assembly behavior', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <ManageExceptionsModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{
          exceptions: {
            mle: {
              enabled: true,
              totalAmount: '6000000',
              usedAmount: '2000000',
              seasonKey: '2025-26',
              notes: '',
            },
            bae: {
              enabled: false,
              totalAmount: '4700000',
              usedAmount: '1000000',
              seasonKey: '2025-26',
              notes: 'carry',
            },
            room: {
              enabled: false,
              totalAmount: '7900000',
              usedAmount: 0,
              seasonKey: '2025-26',
            },
          },
        }}
      />
    );

    const table = screen.getByRole('table');
    expect(normalizedTexts(within(table).getAllByRole('columnheader'))).toEqual([
      'Enabled',
      'Exception Type',
      'Total Amount',
      'Used Amount',
      'Remaining',
      'Notes',
    ]);

    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(4);
    expect(normalizedTexts(bodyRows)).toEqual([
      expect.stringContaining('Mid-Level Exception (MLE)'),
      expect.stringContaining('Taxpayer MLE'),
      expect.stringContaining('Bi-Annual Exception (BAE)'),
      expect.stringContaining('Room Exception'),
    ]);

    const summaryHeading = screen.getByText(/Reference: Default Exception Amounts/i);
    expectBefore(table, summaryHeading);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expectBefore(cancelButton, saveButton);

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      mle: {
        enabled: true,
        totalAmount: 6000000,
        usedAmount: 2000000,
        seasonKey: '2025-26',
      },
      bae: {
        enabled: false,
        totalAmount: 4700000,
        usedAmount: 1000000,
        seasonKey: '2025-26',
        notes: 'carry',
      },
    });
    expect(Object.keys(onSave.mock.calls[0][0])).toEqual(['mle', 'bae']);
  });

  it('uses TPE expiry fallback fields and prefers expiresOn when present', () => {
    hoistedMocks.tpeList = [
      {
        amount: 1_500_000,
        createdFrom: 'Trade A',
        expirationDate: '2027-06-30',
      },
    ];

    const { rerender } = render(
      <ExceptionTracker teamCapSheet={{ hardCapped: 0 }} currentYear={2026} />
    );
    expect(screen.getByText('2027-06-30')).toBeInTheDocument();

    hoistedMocks.tpeList = [
      {
        amount: 1_500_000,
        createdFrom: 'Trade A',
        expiresOn: '2027-07-15',
        expirationDate: '2027-06-30',
        expires: '2027-05-01',
      },
    ];

    rerender(
      <ExceptionTracker teamCapSheet={{ hardCapped: 0 }} currentYear={2026} />
    );

    expect(screen.getByText('2027-07-15')).toBeInTheDocument();
    expect(screen.queryByText('2027-06-30')).not.toBeInTheDocument();
  });

  it('keeps exceptions modal open with inline error when save fails', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(false);

    render(
      <ManageExceptionsModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{ exceptions: {} }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to save exceptions'
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps exceptions modal open and shows thrown save errors above the footer buttons', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new Error('Exploded save'));

    render(
      <ManageExceptionsModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{ exceptions: {} }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Exploded save');
    expectBefore(alert, screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses cancel to close ManageExceptionsModal without saving', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <ManageExceptionsModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{ exceptions: {} }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps dead money modal open with inline error when save fails', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(false);

    render(
      <ManageDeadMoneyModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{ deadCap: [] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to save dead money changes'
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('preserves ManageDeadMoneyModal visible order and row-to-payload mapping behavior', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <ManageDeadMoneyModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{
          deadCap: [
            {
              playerId: 'p_dead',
              playerName: 'Stretched Buyout',
              stretched: true,
              amountByYear: [
                { season: '2025-26', amount: 3000000 },
                { season: '2026-27', amount: 3000000, isStretched: true },
              ],
            },
          ],
        }}
      />
    );

    const table = screen.getByRole('table');
    expect(normalizedTexts(within(table).getAllByRole('columnheader'))).toEqual([
      'Description / Player',
      'Season',
      'Amount',
      'Stretched',
      '',
    ]);

    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    const addButton = screen.getByRole('button', { name: /add entry/i });
    expectBefore(table, addButton);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expectBefore(cancelButton, saveButton);

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith([
      {
        playerId: 'p_dead',
        playerName: 'Stretched Buyout',
        amountByYear: [
          {
            season: '2025-26',
            amount: 3000000,
            isStretched: true,
          },
        ],
        notes: 'Manual Adjustment',
      },
      {
        playerId: 'p_dead',
        playerName: 'Stretched Buyout',
        amountByYear: [
          {
            season: '2026-27',
            amount: 3000000,
            isStretched: true,
          },
        ],
        notes: 'Manual Adjustment',
      },
    ]);
  });

  it('preserves dead money fallback ID and label behavior for newly added rows', async () => {
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <ManageDeadMoneyModal
        isOpen
        onClose={() => {}}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{ deadCap: [] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add entry/i }));

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], {
      target: { value: 'Waived: John Doe' },
    });
    fireEvent.change(textboxes[1], {
      target: { value: '2027-28' },
    });

    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '2500000' },
    });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const [payload] = onSave.mock.calls[0];
    expect(payload).toHaveLength(1);
    expect(payload[0]).toEqual({
      playerId: expect.stringMatching(/^manual_/),
      playerName: 'Waived: John Doe',
      amountByYear: [
        {
          season: '2027-28',
          amount: 2500000,
          isStretched: true,
        },
      ],
      notes: 'Manual Adjustment',
    });
    expect(Object.keys(payload[0])).toEqual([
      'playerId',
      'playerName',
      'amountByYear',
      'notes',
    ]);
  });

  it('keeps dead money modal open and shows thrown save errors above the footer buttons', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new Error('Dead money exploded'));

    render(
      <ManageDeadMoneyModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{ deadCap: [] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Dead money exploded');
    expectBefore(alert, screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses cancel to close ManageDeadMoneyModal without saving', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <ManageDeadMoneyModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{ deadCap: [] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
