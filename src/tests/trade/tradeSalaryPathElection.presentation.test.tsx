// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TradeSalaryPathElection } from '@/features/architect/tradeMachine/TradeSalaryPathElection';

afterEach(cleanup);

describe('TradeSalaryPathElection owner-facing presentation', () => {
  it('formats every entered salary as currency outside active editing', () => {
    render(
      <TradeSalaryPathElection
        election={{
          version: 1,
          path: 'STANDARD_TPE',
          postAssignmentApronTeamSalary: 214_000_000,
          tradedPlayerPreTradeSalaries: { austin_reaves: 12_345_678 },
        }}
        outgoingPlayers={[{ id: 'austin_reaves', name: 'Austin Reaves' }]}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByLabelText('Post-assignment Apron Team Salary')
    ).toHaveValue('$214,000,000');
    expect(
      screen.getByLabelText('Austin Reaves exact pre-trade Salary')
    ).toHaveValue('$12,345,678');
    expect(screen.queryByText(/governed input/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/generic matching estimate/i)).not.toBeInTheDocument();
  });

  it('accepts a plain amount while focused and returns the numeric value', () => {
    const onChange = vi.fn();
    render(
      <TradeSalaryPathElection
        election={{
          version: 1,
          path: 'STANDARD_TPE',
          postAssignmentApronTeamSalary: null,
          tradedPlayerPreTradeSalaries: {},
        }}
        outgoingPlayers={[]}
        onChange={onChange}
      />
    );

    const input = screen.getByLabelText('Post-assignment Apron Team Salary');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '214000000' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ postAssignmentApronTeamSalary: 214_000_000 })
    );
  });
});
