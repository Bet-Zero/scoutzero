// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { TradeSalaryPathElection } from '@/features/architect/tradeMachine/TradeSalaryPathElection';
import { computeTradeDraftKey } from '@/features/architect/tradeMachine/utils/computeTradeDraftKey';

afterEach(cleanup);

describe('TradeSalaryPathElection owner-facing presentation', () => {
  it('elects a separate minimum acquisition and invalidates the prior trade result', () => {
    const election = {
      version: 1 as const,
      path: 'STANDARD_TPE' as const,
      postAssignmentApronTeamSalary: 180_000_000,
      tradedPlayerPreTradeSalaries: { outgoing: 10_000_000 },
    };
    const onChange = vi.fn();
    const incomingPlayers = [
      { id: 'minimum', name: 'Minimum' },
      { id: 'two', name: 'Two Way', contract: { contractType: 'Two-Way' } },
    ];
    render(
      <TradeSalaryPathElection
        election={election}
        outgoingPlayers={[{ id: 'outgoing', name: 'Outgoing' }]}
        incomingPlayers={incomingPlayers}
        onChange={onChange}
      />
    );
    expect(
      screen.queryByLabelText('Acquire Two Way with Minimum Exception')
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByLabelText('Acquire Minimum with Minimum Exception')
    );
    const updated = onChange.mock.calls[0][0];
    expect(updated).toEqual({
      ...election,
      minimumExceptionPlayerIds: ['minimum'],
    });
    const team = {
      team: { id: 'CHI' },
      sends: [],
      salaryMatchingElection: election,
    };
    expect(computeTradeDraftKey({ teams: [team], yearKey: 2027 })).not.toBe(
      computeTradeDraftKey({
        teams: [{ ...team, salaryMatchingElection: updated }],
        yearKey: 2027,
      })
    );
    expect(
      screen.getByText(/pay still counts against team and apron limits/)
    ).toBeInTheDocument();
  });
  it('lets the GM clear a removed minimum allocation without losing other elections', () => {
    const election = {
      version: 1 as const,
      path: 'STANDARD_TPE' as const,
      postAssignmentApronTeamSalary: 180_000_000,
      tradedPlayerPreTradeSalaries: { outgoing: 10_000_000 },
      minimumExceptionPlayerIds: ['removed', 'remaining'],
    };
    const onChange = vi.fn();
    render(
      <TradeSalaryPathElection
        election={election}
        outgoingPlayers={[]}
        incomingPlayers={[{ id: 'remaining', name: 'Remaining' }]}
        onChange={onChange}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear removed minimum acquisitions' })
    );
    expect(onChange).toHaveBeenCalledWith({
      ...election,
      minimumExceptionPlayerIds: ['remaining'],
    });
  });
  it('explains the Two-Way exclusion instead of asking for a matching amount', () => {
    const players = [
      { id: 'two-way', name: 'Two Way', contract: { contractType: 'Two-Way' } },
      { id: 'standard', name: 'Standard' },
    ];
    render(
      <TradeSalaryPathElection
        outgoingPlayers={players}
        onChange={vi.fn()}
        election={{
          version: 1,
          path: 'STANDARD_TPE',
          postAssignmentApronTeamSalary: null,
          tradedPlayerPreTradeSalaries: {},
        }}
      />
    );
    expect(
      screen.getByText(/Two Way · Two-Way: excluded from salary matching/)
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Two Way exact pre-trade Salary')
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Standard exact pre-trade Salary')
    ).toBeInTheDocument();
  });
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
    expect(
      screen.queryByText(/generic matching estimate/i)
    ).not.toBeInTheDocument();
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

  it('preserves an intermediate decimal draft while controlled values update', () => {
    const observedValues: Array<number | null> = [];
    const Harness = () => {
      const [amount, setAmount] = useState<number | null>(null);
      return (
        <TradeSalaryPathElection
          election={{
            version: 1,
            path: 'STANDARD_TPE',
            postAssignmentApronTeamSalary: amount,
            tradedPlayerPreTradeSalaries: {},
          }}
          outgoingPlayers={[]}
          onChange={(next) => {
            const value = next?.postAssignmentApronTeamSalary ?? null;
            observedValues.push(value);
            setAmount(value);
          }}
        />
      );
    };

    render(<Harness />);
    const input = screen.getByLabelText('Post-assignment Apron Team Salary');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12' } });
    expect(input).toHaveValue('12');
    fireEvent.change(input, { target: { value: '12.' } });
    expect(input).toHaveValue('12.');
    fireEvent.change(input, { target: { value: '12.5' } });
    expect(input).toHaveValue('12.5');
    expect(observedValues).toEqual([12, 12, 12.5]);
    fireEvent.blur(input);
    expect(input).toHaveValue('$12.5');
  });
});
