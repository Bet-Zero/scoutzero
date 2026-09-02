// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TradeSalaryCalculator } from '@/features/architect/tradeMachine/TradeSalaryCalculator';

describe('TradeSalaryCalculator governed counterfactual', () => {
  afterEach(cleanup);

  it('uses no generic estimate before an official validation result exists', () => {
    render(<TradeSalaryCalculator hasValidatorResult={false} />);

    expect(screen.getByText('Salary Path Counterfactual')).toBeTruthy();
    expect(
      screen.getByText(
        /Validate the selected salary path to see the matching result/i
      )
    ).toBeTruthy();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('shows only the official path limit and rule after validation', () => {
    render(
      <TradeSalaryCalculator
        hasValidatorResult
        validatorAllowableIncoming={20_000_000}
        validatorRule="Room path"
      />
    );

    expect(screen.getByText('$20,000,000')).toBeTruthy();
    expect(screen.getByText('Room path')).toBeTruthy();
    expect(
      screen.getByText(/Uses only the last official validation result/i)
    ).toBeTruthy();
  });

  it('does not imply pass or fail until a counterfactual value is entered', () => {
    render(
      <TradeSalaryCalculator
        hasValidatorResult
        validatorAllowableIncoming={20_000_000}
      />
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.queryByText(/Within the validated path/i)).toBeNull();
    expect(screen.queryByText(/Exceeds the validated path/i)).toBeNull();

    fireEvent.change(input, { target: { value: '20000000' } });
    expect(screen.getByText('Within the validated path by $0.')).toBeTruthy();

    fireEvent.change(input, { target: { value: '20000000.01' } });
    expect(
      screen.getByText('Exceeds the validated path by $0.01.')
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(screen.queryByText(/Within the validated path/i)).toBeNull();
    expect(screen.queryByText(/Exceeds the validated path/i)).toBeNull();
  });

  it('reports skip and needs-input states without a counterfactual verdict', () => {
    const { rerender } = render(
      <TradeSalaryCalculator
        hasValidatorResult
        validatorAllowableIncoming={null}
        validatorSkipReason="TPE_ABSORPTION"
      />
    );

    expect(
      screen.getByText(/Salary matching not applicable \(TPE_ABSORPTION\)/i)
    ).toBeTruthy();

    rerender(
      <TradeSalaryCalculator
        hasValidatorResult
        validatorAllowableIncoming={null}
      />
    );
    expect(
      screen.getByText(/Exact governed inputs are still required/i)
    ).toBeTruthy();
  });
});
