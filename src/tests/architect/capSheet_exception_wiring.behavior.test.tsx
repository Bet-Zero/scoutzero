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
import { ExceptionTracker } from '@/features/architect/capSheet/ExceptionTracker/ExceptionTracker';
import { ManageExceptionsModal } from '@/features/architect/capSheet/modals/ManageExceptionsModal';
import { ManageDeadMoneyModal } from '@/features/architect/capSheet/modals/ManageDeadMoneyModal';
import {
  getCapSettingsForYear,
  getExceptionDefaultAmountFromCapSettings,
  type ExceptionDefaultCapSettings,
} from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import { canUseRoomException } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import type { TradeExceptionLike } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';

const hoistedMocks = vi.hoisted(() => ({
  tpeList: [] as TradeExceptionLike[],
  buildCapSettings: (overrides: Record<string, unknown> = {}) => ({
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
    const actual = (await importOriginal()) as Record<string, unknown>;
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

function normalizedTexts(elements: HTMLElement[]) {
  return elements.map((element) =>
    element.textContent?.replace(/\s+/g, ' ').trim() || ''
  );
}

function expectBefore(first: HTMLElement, second: HTMLElement) {
  expect(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  ).not.toBe(0);
}

const asExceptionDefaultCapSettings = (value: Record<string, unknown>) =>
  value as unknown as Partial<ExceptionDefaultCapSettings>;

const getExceptionCard = (trackerSection: HTMLElement, label: string) => {
  const card = within(trackerSection).getByText(label).closest('div.relative');
  expect(card).not.toBeNull();
  return card as HTMLElement;
};

// BZE-216: exception cards and the TPE list are collapsed by default behind
// the tracker banner's details toggle; expand before asserting card detail.
const expandExceptionDetails = () => {
  fireEvent.click(
    screen.getByTestId('cap-sheet-exceptions-details-toggle')
  );
};

// The exceptions modal is a status board (cards), not a table. This finds the
// card for a given exception label within the modal.
const getModalExceptionCard = (label: string) => {
  const modal = screen.getByTestId('manage-exceptions-modal');
  const card = within(modal).getByText(label).closest('div.rounded-xl');
  expect(card).not.toBeNull();
  return card as HTMLElement;
};

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
      } as unknown as Partial<ExceptionDefaultCapSettings>)
    ).toBe(0);
    expect(
      getExceptionDefaultAmountFromCapSettings('tpmle', {
        taxMLE: 93_000_000,
        tpmle: 94_000_000,
      } as unknown as Partial<ExceptionDefaultCapSettings>)
    ).toBe(0);
    expect(
      getExceptionDefaultAmountFromCapSettings('room', {
        room: 95_000_000,
      } as unknown as Partial<ExceptionDefaultCapSettings>)
    ).toBe(0);
    expect(getExceptionDefaultAmountFromCapSettings('bae', { bae: 3_333_333 })).toBe(
      3_333_333
    );
  });

  it('keeps missing exception ownership unavailable in tracker while the modal seeds canonical season defaults for editing', () => {
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
      'Cap sheet current-season exception authority surface'
    );
    expandExceptionDetails();
    const ntMleCard = getExceptionCard(trackerSection, 'NT-MLE');
    const tpMleCard = getExceptionCard(trackerSection, 'TP-MLE');
    expect(within(ntMleCard).getByText('$0')).toBeInTheDocument();
    expect(within(ntMleCard).getByText('N/A')).toBeInTheDocument();
    expect(within(tpMleCard).getByText('$0')).toBeInTheDocument();
    expect(within(tpMleCard).getByText('N/A')).toBeInTheDocument();
    expect(within(trackerSection).queryByText('$11,111,111')).not.toBeInTheDocument();
    expect(within(trackerSection).queryByText('$2,222,222')).not.toBeInTheDocument();

    // The modal seeds the canonical CBA default amounts (shown as read-only
    // text on each card), not the legacy/top-level values.
    expect(
      within(getModalExceptionCard('Mid-Level Exception (MLE)')).getAllByText(
        '$11,111,111'
      ).length
    ).toBeGreaterThan(0);
    expect(
      within(getModalExceptionCard('Taxpayer MLE')).getAllByText('$2,222,222')
        .length
    ).toBeGreaterThan(0);
    expect(
      within(getModalExceptionCard('Bi-Annual Exception (BAE)')).getAllByText(
        '$3,333,333'
      ).length
    ).toBeGreaterThan(0);
    expect(
      within(getModalExceptionCard('Room Exception')).getAllByText('$4,444,444')
        .length
    ).toBeGreaterThan(0);
  });

  it('updates ExceptionTracker cards after modal save in the same page session', async () => {
    const ExceptionSaveHarness = () => {
      const [teamCapSheet, setTeamCapSheet] = React.useState({
        hardCapped: 0,
        exceptions: {
          mle: {
            enabled: true,
            totalAmount: 9_876_543,
            usedAmount: 111_111,
            remainingAmount: 9_765_432,
          },
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
              remainingAmount: 8_641_976,
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
    const trackerSection = screen.getByLabelText(
      'Cap sheet current-season exception authority surface'
    );
    expandExceptionDetails();

    expect(within(trackerSection).getByText('$9,765,432')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(within(trackerSection).queryByText('$9,765,432')).not.toBeInTheDocument();
    });
    expect(within(trackerSection).getByText('$8,641,976')).toBeInTheDocument();
  });

  it('prefers canonical exception entries over conflicting legacy top-level fallback entries', () => {
    render(
      <ExceptionTracker
        teamCapSheet={{
          exceptions: {
            tpmle: {
              enabled: true,
              totalAmount: 5_000_000,
              usedAmount: 1_000_000,
              remainingAmount: 4_000_000,
            },
          },
          tpMle: {
            amount: 99_000_000,
            used: 0,
            remaining: 99_000_000,
          },
        }}
        currentYear={2026}
      />
    );

    const trackerSection = screen.getByLabelText(
      'Cap sheet current-season exception authority surface'
    );
    expandExceptionDetails();
    const tpMleCard = getExceptionCard(trackerSection, 'TP-MLE');
    expect(within(tpMleCard).getByText('$4,000,000')).toBeInTheDocument();
    expect(within(tpMleCard).queryByText('$99,000,000')).not.toBeInTheDocument();
  });

  it('treats legacy top-level tpMle data as unavailable until it is canonicalized into team.exceptions', () => {
    render(
      <>
        <ExceptionTracker
          teamCapSheet={{
            tpMle: {
              amount: 99_000_000,
              used: 11_000_000,
              remaining: 88_000_000,
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
            tpMle: {
              amount: 99_000_000,
              used: 11_000_000,
              remaining: 88_000_000,
            },
          }}
        />
      </>
    );

    const trackerSection = screen.getByLabelText(
      'Cap sheet current-season exception authority surface'
    );
    expandExceptionDetails();
    const tpMleCard = getExceptionCard(trackerSection, 'TP-MLE');
    expect(within(tpMleCard).getByText('$0')).toBeInTheDocument();
    expect(within(tpMleCard).getByText('N/A')).toBeInTheDocument();
    expect(within(tpMleCard).queryByText('$88,000,000')).not.toBeInTheDocument();

    const taxpayerCard = getModalExceptionCard('Taxpayer MLE');
    // Seeds the CBA default ($5,000,000), not the legacy top-level value.
    expect(
      within(taxpayerCard).getAllByText('$5,000,000').length
    ).toBeGreaterThan(0);
    expect(
      within(taxpayerCard).queryByText('$88,000,000')
    ).not.toBeInTheDocument();
    expect(within(taxpayerCard).getByRole('checkbox')).not.toBeChecked();
  });

  it('does not render legacy-only top-level exception data when the canonical exception entry is absent', () => {
    render(
      <ExceptionTracker
        teamCapSheet={{
          bae: {
            amount: 4_700_000,
            used: 1_000_000,
            remaining: 3_700_000,
          },
        }}
        currentYear={2026}
      />
    );

    const trackerSection = screen.getByLabelText(
      'Cap sheet current-season exception authority surface'
    );
    expandExceptionDetails();
    const baeCard = getExceptionCard(trackerSection, 'BAE');
    expect(within(baeCard).getByText('$0')).toBeInTheDocument();
    expect(within(baeCard).getByText('N/A')).toBeInTheDocument();
    expect(within(baeCard).queryByText('$3,700,000')).not.toBeInTheDocument();
  });

  it('does not let legacy top-level fallback override a canonical disabled exception entry', () => {
    render(
      <ExceptionTracker
        teamCapSheet={{
          exceptions: {
            mle: {
              enabled: false,
              totalAmount: 12_800_000,
              usedAmount: 0,
              remainingAmount: 12_800_000,
            },
          },
          mle: {
            amount: 99_000_000,
            used: 0,
            remaining: 99_000_000,
          },
        }}
        currentYear={2026}
      />
    );

    const trackerSection = screen.getByLabelText(
      'Cap sheet current-season exception authority surface'
    );
    expandExceptionDetails();
    const mleCard = getExceptionCard(trackerSection, 'NT-MLE');
    expect(within(mleCard).getByText('$0')).toBeInTheDocument();
    expect(within(mleCard).getByText('N/A')).toBeInTheDocument();
    expect(within(mleCard).queryByText('$99,000,000')).not.toBeInTheDocument();
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
      'Cap sheet current-season exception authority surface'
    );
    expandExceptionDetails();
    const roomCard = getExceptionCard(trackerSection, 'ROOM');
    expect(within(roomCard).getByText('$0')).toBeInTheDocument();
    expect(within(roomCard).getByText('N/A')).toBeInTheDocument();
    expect(within(trackerSection).queryByText('$4,444,444')).not.toBeInTheDocument();

    const modalRoomCard = getModalExceptionCard('Room Exception');
    expect(modalRoomCard).toHaveTextContent(
      'Only available to teams under the salary cap'
    );
    expect(within(modalRoomCard).getByRole('checkbox')).toBeDisabled();
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
      'Cap sheet current-season exception authority surface'
    );
    expandExceptionDetails();
    const roomCard = getExceptionCard(trackerSection, 'ROOM');
    expect(within(roomCard).getByText('$0')).toBeInTheDocument();
    expect(within(roomCard).getByText('N/A')).toBeInTheDocument();
    expect(within(trackerSection).queryByText('$5,900,000')).not.toBeInTheDocument();

    const modalRoomCard = getModalExceptionCard('Room Exception');
    expect(modalRoomCard).toHaveTextContent(
      'Only available to teams under the salary cap'
    );
    expect(within(modalRoomCard).getByRole('checkbox')).toBeDisabled();
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
      'Cap sheet current-season exception authority surface'
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
      'Cap sheet current-season exception authority surface'
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

  it('does not infer hard-cap usage from legacy top-level MLE compatibility state', () => {
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
      'Cap sheet current-season exception authority surface'
    );

    expect(within(trackerSection).getByText('No Hard Cap Active')).toBeInTheDocument();
    expect(
      within(trackerSection).queryByText(
        'Hard capped at 1st Apron due to usage of Non-Taxpayer MLE or BAE.'
      )
    ).not.toBeInTheDocument();
    expect(
      within(trackerSection).queryByText(
        'Hard cap triggered at First Apron via Non-Taxpayer MLE usage.'
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

  it('preserves ManageExceptionsModal visible row order, button order, and owned current-season save behavior', async () => {
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
              seasonKey: '2024-25',
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

    // The modal is a status board (no inputs): exceptions render as cards in
    // canonical order, each with an availability toggle.
    const mleLabel = screen.getByText('Mid-Level Exception (MLE)');
    const tpmleLabel = screen.getByText('Taxpayer MLE');
    const baeLabel = screen.getByText('Bi-Annual Exception (BAE)');
    const roomLabel = screen.getByText('Room Exception');
    expectBefore(mleLabel, tpmleLabel);
    expectBefore(tpmleLabel, baeLabel);
    expectBefore(baeLabel, roomLabel);

    // One availability toggle per exception, MLE first.
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expectBefore(cancelButton, saveButton);

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    // Amounts are CBA-fixed (not typed) and usage is preserved from the team's
    // actual exception state — so totalAmount is whatever the cap settings say,
    // while usedAmount carries through from the loaded entries.
    expect(onSave).toHaveBeenCalledWith({
      mle: expect.objectContaining({
        type: 'mle',
        enabled: true,
        available: true,
        usedAmount: 2000000,
        seasonKey: '2025-26',
        totalAmount: expect.any(Number),
      }),
      bae: expect.objectContaining({
        type: 'bae',
        enabled: false,
        available: false,
        usedAmount: 1000000,
        seasonKey: '2025-26',
        notes: 'carry',
        totalAmount: expect.any(Number),
      }),
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
    expandExceptionDetails();
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

  it('preserves ManageDeadMoneyModal visible order and grouped replacement behavior', async () => {
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
              originalSalary: 9000000,
              waiveDate: '2025-07-01',
              notes: 'Stretch ledger',
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
        originalSalary: 9000000,
        amountByYear: [
          {
            season: '2025-26',
            amount: 3000000,
            isStretched: true,
          },
          {
            season: '2026-27',
            amount: 3000000,
            isStretched: true,
          },
        ],
        waiveDate: '2025-07-01',
        notes: 'Stretch ledger',
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
