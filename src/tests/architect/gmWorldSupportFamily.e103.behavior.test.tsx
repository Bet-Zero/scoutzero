/**
 * FILE: src/tests/architect/gmWorldSupportFamily.e103.behavior.test.tsx
 * PURPOSE: Focused UI coverage for the E103 GM world-support TS surfaces.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DeleteWorldModal } from '@/features/architect/GMDashboard/components/DeleteWorldModal';
import { WorldTimeControls } from '@/features/architect/GMDashboard/components/WorldTimeControls';
import DraftPositionsInput from '@/features/architect/GMDashboard/components/DraftPositionsInput';

const {
  mockUpdateWorldMetadata,
  mockLoadCommittedDraftPositions,
  mockSaveCommittedDraftPositions,
  mockClearCommittedDraftPositions,
  mockValidateDraftPositionsMap,
} = vi.hoisted(() => ({
  mockUpdateWorldMetadata: vi.fn(),
  mockLoadCommittedDraftPositions: vi.fn(),
  mockSaveCommittedDraftPositions: vi.fn(),
  mockClearCommittedDraftPositions: vi.fn(),
  mockValidateDraftPositionsMap: vi.fn(),
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldMetadata: mockUpdateWorldMetadata,
}));

const FIXED_SYSTEM_TIME = new Date('2026-03-15T12:00:00.000Z');
const EXPECTED_TEMPLATE = `{
  "ATL": 1,
  "BOS": 2,
  "BKN": 3,
  "CHA": 4,
  "CHI": 5,
  "CLE": 6,
  "DAL": 7,
  "DEN": 8,
  "DET": 9,
  "GSW": 10,
  "HOU": 11,
  "IND": 12,
  "LAC": 13,
  "LAL": 14,
  "MEM": 15,
  "MIA": 16,
  "MIL": 17,
  "MIN": 18,
  "NOP": 19,
  "NYK": 20,
  "OKC": 21,
  "ORL": 22,
  "PHI": 23,
  "PHX": 24,
  "POR": 25,
  "SAC": 26,
  "SAS": 27,
  "TOR": 28,
  "UTA": 29,
  "WAS": 30
}`;

const renderDraftPositionsInput = (
  overrides: Partial<React.ComponentProps<typeof DraftPositionsInput>> = {}
) =>
  render(
    <DraftPositionsInput
      persistenceAuthority={{
        loadCommittedDraftPositions: mockLoadCommittedDraftPositions,
        saveCommittedDraftPositions: mockSaveCommittedDraftPositions,
        clearCommittedDraftPositions: mockClearCommittedDraftPositions,
      }}
      validateDraftPositionsMap={mockValidateDraftPositionsMap}
      worldId="world_1"
      defaultDraftYear={2026}
      worldSeason="2025-26"
      {...overrides}
    />
  );

describe('GM world-support family E103 behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FIXED_SYSTEM_TIME);
    vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('MOCKED_LOCALE');

    mockUpdateWorldMetadata.mockResolvedValue(undefined);
    mockLoadCommittedDraftPositions.mockResolvedValue(null);
    mockSaveCommittedDraftPositions.mockResolvedValue({
      positionsMap: { ATL: 1, BOS: 2 },
      method: 'manual',
      updatedAtIso: '2026-03-15T12:00:00.000Z',
    });
    mockClearCommittedDraftPositions.mockResolvedValue(undefined);
    mockValidateDraftPositionsMap.mockReturnValue({
      valid: true,
      errors: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('preserves DeleteWorldModal copy, confirm gating, and input callback behavior', () => {
    const setConfirmText = vi.fn();
    const noop = vi.fn();
    const { rerender } = render(
      <DeleteWorldModal
        worldName="World Alpha"
        confirmText=""
        setConfirmText={setConfirmText}
        onClose={noop}
        onDelete={noop}
        isSubmitting={false}
        error={null}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Delete World Permanently' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('⚠️ This action is irreversible!')
    ).toBeInTheDocument();
    expect(screen.getByText('All team snapshots')).toBeInTheDocument();
    expect(screen.getByText('All player overrides')).toBeInTheDocument();
    expect(screen.getByText('World metadata and history')).toBeInTheDocument();

    const confirmInput = screen.getByLabelText(
      /Type DELETE or World Alpha to confirm:/i
    );
    const deleteButton = screen.getByRole('button', {
      name: 'Delete Permanently',
    });

    expect(deleteButton).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: 'DELETE' } });
    expect(setConfirmText).toHaveBeenCalledWith('DELETE');

    rerender(
      <DeleteWorldModal
        worldName="World Alpha"
        confirmText="DELETE"
        setConfirmText={setConfirmText}
        onClose={noop}
        onDelete={noop}
        isSubmitting={false}
        error={null}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Delete Permanently' })
    ).toBeEnabled();
  });

  it('preserves DeleteWorldModal close, confirm, and submitting-state behavior', () => {
    const onClose = vi.fn();
    const onDelete = vi.fn();
    const { container, rerender } = render(
      <DeleteWorldModal
        worldName="World Alpha"
        confirmText="World Alpha"
        setConfirmText={vi.fn()}
        onClose={onClose}
        onDelete={onDelete}
        isSubmitting={false}
        error="Delete failed"
      />
    );

    fireEvent.click(container.querySelector('[aria-hidden="true"]') as Element);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Delete failed')).toBeInTheDocument();

    rerender(
      <DeleteWorldModal
        worldName="World Alpha"
        confirmText="DELETE"
        setConfirmText={vi.fn()}
        onClose={onClose}
        onDelete={onDelete}
        isSubmitting={true}
        error={null}
      />
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Deleting\.\.\./ })).toBeDisabled();
  });

  it('preserves WorldTimeControls null render, test ids, copy, and system fallback display semantics', () => {
    const { rerender } = render(
      <WorldTimeControls
        worldId={null}
        asOfDate={null}
        setAsOfDate={vi.fn()}
      />
    );

    expect(screen.queryByTestId('world-time-controls')).not.toBeInTheDocument();

    rerender(
      <WorldTimeControls
        worldId="world_1"
        asOfDate={null}
        setAsOfDate={vi.fn()}
      />
    );

    expect(screen.getByTestId('world-time-controls')).toBeInTheDocument();
    expect(screen.getByText('World Date')).toBeInTheDocument();
    expect(screen.getByText('(System)')).toBeInTheDocument();
    expect(screen.getByTestId('advance-day-button')).toHaveTextContent('+1 Day');
    expect(screen.getByTestId('world-date-input')).toHaveValue('2026-03-15');
  });

  it('preserves WorldTimeControls direct date persistence behavior', async () => {
    const setAsOfDate = vi.fn();
    render(
      <WorldTimeControls
        worldId="world_1"
        asOfDate="2026-03-15"
        setAsOfDate={setAsOfDate}
      />
    );

    fireEvent.change(screen.getByTestId('world-date-input'), {
      target: { value: '2026-03-20' },
    });

    await waitFor(() => {
      expect(mockUpdateWorldMetadata).toHaveBeenCalledWith('world_1', {
        asOfDate: '2026-03-20',
      });
    });
    expect(setAsOfDate).toHaveBeenCalledWith('2026-03-20');
  });

  it('preserves WorldTimeControls +1 day persistence behavior', async () => {
    const setAsOfDate = vi.fn();
    render(
      <WorldTimeControls
        worldId="world_1"
        asOfDate="2026-03-15"
        setAsOfDate={setAsOfDate}
      />
    );

    fireEvent.click(screen.getByTestId('advance-day-button'));

    await waitFor(() => {
      expect(mockUpdateWorldMetadata).toHaveBeenCalledWith('world_1', {
        asOfDate: '2026-03-16',
      });
    });
    expect(setAsOfDate).toHaveBeenCalledWith('2026-03-16');
  });

  it('preserves WorldTimeControls error handling without local callback writes', async () => {
    const setAsOfDate = vi.fn();
    const error = new Error('advance failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateWorldMetadata.mockRejectedValueOnce(error);

    render(
      <WorldTimeControls
        worldId="world_1"
        asOfDate="2026-03-15"
        setAsOfDate={setAsOfDate}
      />
    );

    fireEvent.click(screen.getByTestId('advance-day-button'));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to advance world time:',
        error
      );
    });
    expect(setAsOfDate).not.toHaveBeenCalled();
  });

  it('preserves DraftPositionsInput empty-world placeholder copy', () => {
    render(
      <DraftPositionsInput
        persistenceAuthority={{
          loadCommittedDraftPositions: mockLoadCommittedDraftPositions,
          saveCommittedDraftPositions: mockSaveCommittedDraftPositions,
          clearCommittedDraftPositions: mockClearCommittedDraftPositions,
        }}
        validateDraftPositionsMap={mockValidateDraftPositionsMap}
        worldId={null}
        defaultDraftYear={2026}
      />
    );

    expect(
      screen.getByText('Select a world to enter draft positions.')
    ).toBeInTheDocument();
  });

  it('preserves DraftPositionsInput load flow, field ordering, helper copy, button ordering, and year options', async () => {
    mockLoadCommittedDraftPositions.mockResolvedValueOnce({
      positionsMap: { ATL: 1, BOS: 2 },
      method: 'manual',
      updatedAtIso: '2026-03-10T08:30:00.000Z',
    });

    renderDraftPositionsInput();

    await waitFor(() => {
      expect(mockLoadCommittedDraftPositions).toHaveBeenCalledWith(2026);
    });

    expect(
      screen.getByRole('heading', { name: 'Draft Positions Input' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Enter real draft positions to auto-resolve pick swaps and conveyance during season advance.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('World Season: 2025-26 — Default draft year: 2026')
    ).toBeInTheDocument();

    const draftYearLabel = screen.getByText('Draft Year');
    const positionsJsonLabel = screen.getByText(/Positions JSON/);
    expect(
      draftYearLabel.compareDocumentPosition(positionsJsonLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Validate',
      'Save',
      'Reset Editor',
      'Clear Saved Positions',
    ]);

    expect(screen.getByRole('textbox')).toHaveValue(`{\n  "ATL": 1,\n  "BOS": 2\n}`);
    expect(screen.getByText('Last saved: MOCKED_LOCALE (manual)')).toBeInTheDocument();
    expect(screen.getByText(/How it works:/)).toBeInTheDocument();
    expect(screen.getByText(/When you advance the season:/)).toBeInTheDocument();
    expect(screen.getByText(/Editor vs saved state:/)).toBeInTheDocument();
    expect(screen.getByText(/NO-OP guarantee:/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear Saved Positions' })
    ).toBeEnabled();

    const yearOptions = screen
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(yearOptions).toEqual([
      '2026',
      '2027',
      '2028',
      '2029',
      '2030',
      '2031',
      '2032',
      '2033',
    ]);
  });

  it('re-syncs DraftPositionsInput selected year when defaultDraftYear changes', async () => {
    const { rerender } = renderDraftPositionsInput();

    await waitFor(() => {
      expect(mockLoadCommittedDraftPositions).toHaveBeenCalledWith(2026);
    });

    rerender(
      <DraftPositionsInput
        persistenceAuthority={{
          loadCommittedDraftPositions: mockLoadCommittedDraftPositions,
          saveCommittedDraftPositions: mockSaveCommittedDraftPositions,
          clearCommittedDraftPositions: mockClearCommittedDraftPositions,
        }}
        validateDraftPositionsMap={mockValidateDraftPositionsMap}
        worldId="world_1"
        defaultDraftYear={2028}
        worldSeason="2027-28"
      />
    );

    await waitFor(() => {
      expect(mockLoadCommittedDraftPositions).toHaveBeenCalledWith(2028);
    });
    expect(screen.getByDisplayValue('2028')).toBeInTheDocument();
  });

  it('preserves DraftPositionsInput template fallback and load-error messaging', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLoadCommittedDraftPositions.mockRejectedValueOnce(new Error('load failed'));

    renderDraftPositionsInput();

    await waitFor(() => {
      expect(
        screen.getByText('Error loading: load failed')
      ).toBeInTheDocument();
    });
    expect(consoleError).toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue(EXPECTED_TEMPLATE);
  });

  it('shows explicit no-saved-state copy when no committed draft positions exist for the selected year', async () => {
    renderDraftPositionsInput();

    await waitFor(() => {
      expect(mockLoadCommittedDraftPositions).toHaveBeenCalledWith(2026);
    });

    expect(screen.getByRole('textbox')).toHaveValue(EXPECTED_TEMPLATE);
    expect(
      screen.getByText(
        'No saved draft positions for 2026. Editor is showing the template.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear Saved Positions' })
    ).toBeDisabled();
  });

  it('preserves DraftPositionsInput empty-json and parse-failure validation behavior', async () => {
    renderDraftPositionsInput();

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue(EXPECTED_TEMPLATE);
    });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(screen.getByText('JSON is empty')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(screen.getByText(/Invalid JSON:/)).toBeInTheDocument();
  });

  it('preserves DraftPositionsInput validator-error behavior and blocks save writes', async () => {
    mockValidateDraftPositionsMap.mockReturnValueOnce({
      valid: false,
      errors: ['Invalid team code: "phi" (must be 3 uppercase letters)'],
    });

    renderDraftPositionsInput();

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue(EXPECTED_TEMPLATE);
    });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '{"phi": 5}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockValidateDraftPositionsMap).toHaveBeenCalledWith({ phi: 5 });
    });
    expect(
      screen.getByText('Invalid team code: "phi" (must be 3 uppercase letters)')
    ).toBeInTheDocument();
    expect(mockSaveCommittedDraftPositions).not.toHaveBeenCalled();
  });

  it('preserves DraftPositionsInput validation, save, reset, and clear messaging truth', async () => {
    mockLoadCommittedDraftPositions.mockResolvedValueOnce({
      positionsMap: { ATL: 1, BOS: 2 },
      method: 'manual',
      updatedAtIso: '2026-03-10T08:30:00.000Z',
    });
    mockSaveCommittedDraftPositions.mockResolvedValueOnce({
      positionsMap: { ATL: 1, BOS: 2 },
      method: 'imported',
      updatedAtIso: '2026-03-11T09:45:00.000Z',
    });

    renderDraftPositionsInput();

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue(`{\n  "ATL": 1,\n  "BOS": 2\n}`);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(
      screen.getByText('Editor JSON is valid but not yet saved.')
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '{"ATL": 1, "BOS": 2}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockSaveCommittedDraftPositions).toHaveBeenCalledWith(
        2026,
        { ATL: 1, BOS: 2 }
      );
    });
    expect(
      screen.getByText(
        '✅ Saved draft positions for 2026. Editor refreshed from committed world data.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Last saved: MOCKED_LOCALE (imported)')
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '{"ATL": 9}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Editor' }));
    expect(
      screen.getByText(
        'Editor reset to the last saved draft positions. Saved positions were not cleared.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue(`{\n  "ATL": 1,\n  "BOS": 2\n}`);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Saved Positions' }));
    await waitFor(() => {
      expect(mockClearCommittedDraftPositions).toHaveBeenCalledWith(2026);
    });
    expect(
      screen.getByText(
        '✅ Cleared saved draft positions for 2026. The editor is now showing the template.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue(EXPECTED_TEMPLATE);
    expect(
      screen.getByText(
        'No saved draft positions for 2026. Editor is showing the template.'
      )
    ).toBeInTheDocument();
  });

  it('preserves DraftPositionsInput save-error messaging and template-only reset behavior', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSaveCommittedDraftPositions.mockRejectedValueOnce(
      new Error('Duplicate position 1')
    );

    renderDraftPositionsInput();

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue(EXPECTED_TEMPLATE);
    });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '{"ATL": 1, "BOS": 1}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Error: Duplicate position 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset Editor' }));

    expect(screen.getByRole('textbox')).toHaveValue(EXPECTED_TEMPLATE);
    expect(
      screen.getByText(
        'Editor reset to the template. No saved positions were cleared.'
      )
    ).toBeInTheDocument();
    expect(mockClearCommittedDraftPositions).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });
});
