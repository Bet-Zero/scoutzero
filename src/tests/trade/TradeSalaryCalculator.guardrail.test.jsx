/**
 * FILE: TradeSalaryCalculator.guardrail.test.jsx
 * PURPOSE: Guardrail test ensuring P2 visual separation per Master Doc Section 3.4
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *  - 2026-01-01: Created for P2 DONE pass (MASTER_TRADE_MACHINE_ALIGNMENT.md v1.2.1)
 * LINKS: TradeSalaryCalculator.jsx, MASTER_TRADE_MACHINE_ALIGNMENT.md Section 3.4
 */

/**
 * TradeSalaryCalculator Guardrail Tests
 *
 * Purpose: Lock down the P2 requirement that TradeSalaryCalculator clearly separates
 * "Sandbox Estimate" values (local) from "Official Validator Result" values (snapshot).
 * These tests will fail if someone removes the visual separation or uses wrong values.
 *
 * Coverage:
 * 1. When validator result exists: renders "Official Validator Result" section
 * 2. Always renders "Sandbox Estimate" section
 * 3. Official allowableIncoming displayed is from props, not local calc
 * 4. Disclaimer is always present
 */
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import TradeSalaryCalculator from '@/features/architect/tradeMachine/TradeSalaryCalculator';

// Mock cap settings (required for component to render)
const mockCapSettings = {
  salaryCap: 141_000_000,
  firstApron: 178_132_000,
  secondApron: 188_931_000,
};

describe('TradeSalaryCalculator Guardrail Tests (P2)', () => {
  // Clean up after each test to avoid state pollution
  afterEach(() => {
    cleanup();
  });

  describe('Visual Separation Requirement (Master Doc 3.4)', () => {
    it('P2-GR-01: renders "Official Validator Result" section when validator result exists', () => {
      render(
        <TradeSalaryCalculator
          teamSalary={160_000_000}
          outgoingSalary={15_000_000}
          capSettings={mockCapSettings}
          yearKey={2025}
          // P2 props: validator result available
          hasValidatorResult={true}
          validatorAllowableIncoming={20_000_000}
          validatorRule="OVER_CAP_BAND_2"
        />
      );

      // Must render the Official Validator Result section header
      expect(screen.getByText('Official Validator Result')).toBeTruthy();
    });

    it('P2-GR-02: renders "Sandbox Estimate" section when validator result exists', () => {
      render(
        <TradeSalaryCalculator
          teamSalary={160_000_000}
          outgoingSalary={15_000_000}
          capSettings={mockCapSettings}
          yearKey={2025}
          hasValidatorResult={true}
          validatorAllowableIncoming={20_000_000}
          validatorRule="OVER_CAP_BAND_2"
        />
      );

      // Must render Sandbox Estimate label with "(local calculation)" suffix
      expect(screen.getByText(/Sandbox Estimate \(local calculation\)/)).toBeTruthy();
    });

    it('P2-GR-03: renders "Sandbox Estimate" section when NO validator result exists', () => {
      render(
        <TradeSalaryCalculator
          teamSalary={160_000_000}
          outgoingSalary={15_000_000}
          capSettings={mockCapSettings}
          yearKey={2025}
          hasValidatorResult={false}
        />
      );

      // Must still render Sandbox Estimate (without the local calculation suffix)
      expect(screen.getByText('Sandbox Estimate')).toBeTruthy();
    });

    it('P2-GR-04: does NOT render "Official Validator Result" when NO validator result exists', () => {
      render(
        <TradeSalaryCalculator
          teamSalary={160_000_000}
          outgoingSalary={15_000_000}
          capSettings={mockCapSettings}
          yearKey={2025}
          hasValidatorResult={false}
        />
      );

      // Should NOT have Official Validator Result section
      expect(screen.queryByText('Official Validator Result')).toBeNull();
    });
  });

  describe('Official Values Source (Master Doc Invariant 2)', () => {
    it('P2-GR-05: official allowableIncoming displayed is from validatorAllowableIncoming prop, not local', () => {
      const CANONICAL_ALLOWABLE = 25_000_000; // Known official value
      
      render(
        <TradeSalaryCalculator
          teamSalary={160_000_000}
          outgoingSalary={15_000_000}
          capSettings={mockCapSettings}
          yearKey={2025}
          hasValidatorResult={true}
          validatorAllowableIncoming={CANONICAL_ALLOWABLE}
          validatorRule="OVER_CAP_BAND_2"
        />
      );

      // The Official section must display the canonical value from props
      // Format: $25,000,000 based on formatCurrency
      // Find the formatted value directly - formatCurrency formats as "$25,000,000"
      expect(screen.getByText('$25,000,000')).toBeTruthy();
    });

    it('P2-GR-06: official rule displayed is from validatorRule prop', () => {
      const CANONICAL_RULE = 'OVER_CAP_BAND_3';
      
      render(
        <TradeSalaryCalculator
          teamSalary={160_000_000}
          outgoingSalary={15_000_000}
          capSettings={mockCapSettings}
          yearKey={2025}
          hasValidatorResult={true}
          validatorAllowableIncoming={20_000_000}
          validatorRule={CANONICAL_RULE}
        />
      );

      // The official rule must be displayed from props
      expect(screen.getByText(CANONICAL_RULE)).toBeTruthy();
    });
  });

  describe('Disclaimer Requirement (Master Doc 3.4)', () => {
    it('P2-GR-07: always renders exploratory tool disclaimer with authoritative text', () => {
      render(
        <TradeSalaryCalculator
          teamSalary={160_000_000}
          outgoingSalary={15_000_000}
          capSettings={mockCapSettings}
          yearKey={2025}
          hasValidatorResult={true}
          validatorAllowableIncoming={20_000_000}
        />
      );

      // Must render the disclaimer per Section 3.4
      // The disclaimer has the text split across elements (strong tag wraps "Exploratory tool")
      // We verify the container has both required phrases
      const disclaimerContainer = screen.getByText('Exploratory tool').closest('div');
      expect(disclaimerContainer.textContent).toContain('validator is authoritative');
    });

    it('P2-GR-08: disclaimer present even when no validator result', () => {
      render(
        <TradeSalaryCalculator
          teamSalary={160_000_000}
          outgoingSalary={15_000_000}
          capSettings={mockCapSettings}
          yearKey={2025}
          hasValidatorResult={false}
        />
      );

      // Disclaimer must always be present
      expect(screen.getByText('Exploratory tool')).toBeTruthy();
    });
  });

  describe('Validator Differs Message (Master Doc 3.4)', () => {
    it('P2-GR-09: shows "Validator will use" when sandbox differs from official by >$1', () => {
      // Use values where local calculation differs from official
      render(
        <TradeSalaryCalculator
          teamSalary={160_000_000}
          outgoingSalary={15_000_000}
          capSettings={mockCapSettings}
          yearKey={2025}
          hasValidatorResult={true}
          validatorAllowableIncoming={99_999_999} // Intentionally very different
          validatorRule="OVER_CAP_BAND_2"
        />
      );

      // Should show the "Validator will use" message - use getAllBy since multiple may exist
      const validatorMessages = screen.getAllByText(/Validator will use/);
      expect(validatorMessages.length).toBeGreaterThan(0);
    });
  });
});
