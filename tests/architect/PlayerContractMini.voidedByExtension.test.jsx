/**
 * FILE: tests/architect/PlayerContractMini.voidedByExtension.test.jsx
 * PURPOSE: T-3 guard — verifies PlayerContractMini dims and labels voided
 *          year rows when voidedByExtension is true.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PlayerContractMini from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerContractMini';

// Pin CURRENT_YEAR calculation: component uses getFullYear() - (month < 6 ? 1 : 0).
// We set up salary data relative to the same logic so tests are year-stable.
const today = new Date();
const CURRENT_YEAR = today.getFullYear() - (today.getMonth() < 6 ? 1 : 0);

describe('PlayerContractMini — voidedByExtension rendering', () => {
  afterEach(cleanup);
  it('renders "Voided" label for years marked voidedByExtension', () => {
    const contract = {
      isExtension: true,
      salariesByYear: [
        { year: CURRENT_YEAR, salary: 10_000_000, voidedByExtension: true },
        { year: CURRENT_YEAR + 1, salary: 12_000_000, isExtensionSeason: true },
      ],
    };

    render(<PlayerContractMini contract={contract} bird_rights="Bird" />);

    expect(screen.getByText('Voided')).toBeInTheDocument();
  });

  it('does not render "Voided" label when no rows are voided', () => {
    const contract = {
      isExtension: true,
      salariesByYear: [
        { year: CURRENT_YEAR, salary: 10_000_000 },
        { year: CURRENT_YEAR + 1, salary: 12_000_000, isExtensionSeason: true },
      ],
    };

    render(<PlayerContractMini contract={contract} bird_rights="Bird" />);

    expect(screen.queryByText('Voided')).not.toBeInTheDocument();
  });

  it('applies opacity-30 and line-through classes to voided rows', () => {
    const contract = {
      salariesByYear: [
        { year: CURRENT_YEAR, salary: 8_000_000, voidedByExtension: true },
        { year: CURRENT_YEAR + 1, salary: 9_000_000 },
      ],
    };

    render(
      <PlayerContractMini contract={contract} bird_rights="Bird" />
    );

    // Only one voided row — find its label and walk up to the row div
    const voidedLabels = screen.getAllByText('Voided');
    expect(voidedLabels).toHaveLength(1);
    const rowDiv = voidedLabels[0].closest('div.flex');
    expect(rowDiv).toHaveClass('opacity-30');
    expect(rowDiv).toHaveClass('line-through');
  });

  it('still renders salary for non-voided rows alongside voided ones', () => {
    const contract = {
      salariesByYear: [
        { year: CURRENT_YEAR, salary: 8_000_000, voidedByExtension: true },
        { year: CURRENT_YEAR + 1, salary: 15_000_000 },
      ],
    };

    render(<PlayerContractMini contract={contract} bird_rights="Bird" />);

    // The non-voided row should show its salary
    expect(screen.getByText('$15.0M')).toBeInTheDocument();
    // The voided row should show "Voided", not "$8.0M"
    expect(screen.queryByText('$8.0M')).not.toBeInTheDocument();
    expect(screen.getByText('Voided')).toBeInTheDocument();
  });
});
