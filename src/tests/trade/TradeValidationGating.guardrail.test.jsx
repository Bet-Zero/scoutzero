/**
 * FILE: TradeValidationGating.guardrail.test.jsx
 * PURPOSE: Guardrail tests ensuring UX clarity for Trade Machine validation gating and mode tags
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *  - Jan 2026: Created for UX/Mode Legend requirement (Tasks A-F)
 * LINKS: ValidationStateHeader.jsx, ValidationDetailsPanel.jsx, MASTER_TRADE_MACHINE_ALIGNMENT.md
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import ValidationStateHeader, { ModeTag, MODE_TAGS } from '@/features/architect/tradeMachine/ValidationStateHeader';
import ValidationDetailsPanel from '@/features/architect/tradeMachine/ValidationDetailsPanel';

// Mock team data for tests
const mockTeams = [
  {
    team: {
      id: 'BOS',
      nickname: 'Celtics',
      teamTotalSalary: 160_000_000,
      tradeExceptions: [],
    },
    sends: [],
    picksOut: [],
  },
  {
    team: {
      id: 'LAL',
      nickname: 'Lakers',
      teamTotalSalary: 150_000_000,
      tradeExceptions: [],
    },
    sends: [],
    picksOut: [],
  },
];

// Mock result data
const mockResult = {
  legal: true,
  teamResults: [
    {
      teamName: 'Boston Celtics',
      salaryIn: 10_000_000,
      salaryOut: 12_000_000,
      rules: {
        salaryMatching: { passed: true, allowableIncoming: 15_000_000 },
      },
    },
    {
      teamName: 'Los Angeles Lakers',
      salaryIn: 12_000_000,
      salaryOut: 10_000_000,
      rules: {
        salaryMatching: { passed: true, allowableIncoming: 18_000_000 },
      },
    },
  ],
  capSettings: {
    salaryCap: 141_000_000,
    firstApron: 178_132_000,
    secondApron: 188_931_000,
  },
  tradeReceipt: {
    isLegal: true,
    validatorVersion: '2.0',
    yearKey: 2025,
    seasonKey: '2024-25',
    teams: [],
  },
};

const mockPreviewAuthority = {
  legal: true,
  reason: 'Preview authority passed',
  violations: [],
  warnings: [],
  source: 'apply-preview',
  omittedStages: [
    'LEAGUE_INVARIANTS',
    'ENTITLEMENT_INVARIANTS',
    'ENTITLEMENT_EXCLUSIVITY',
  ],
};

const mockCapProjections = {
  salaryCap: 141_000_000,
  firstApron: 178_132_000,
  secondApron: 188_931_000,
};

describe('ValidationStateHeader Guardrail Tests (Task A)', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Validation State Pill', () => {
    it('A-GR-01: shows "Not validated" pill when hasValidatorResult=false', () => {
      render(
        <ValidationStateHeader
          hasValidatorResult={false}
          isValidating={false}
        />
      );

      expect(screen.getByText('Not validated')).toBeTruthy();
    });

    it('A-GR-02: shows "Validating…" pill when isValidating=true', () => {
      render(
        <ValidationStateHeader
          hasValidatorResult={false}
          isValidating={true}
        />
      );

      expect(screen.getByText('Validating…')).toBeTruthy();
    });

    it('A-GR-03: shows "Validated" pill when hasValidatorResult=true', () => {
      render(
        <ValidationStateHeader
          hasValidatorResult={true}
          isValidating={false}
          validatedAt={Date.now()}
        />
      );

      // Should contain "Validated" in the text
      const pill = screen.getByText(/Validated/);
      expect(pill).toBeTruthy();
    });

    it('A-GR-04: shows validation timestamp when provided', () => {
      const timestamp = new Date('2026-01-01T14:30:00').getTime();
      render(
        <ValidationStateHeader
          hasValidatorResult={true}
          isValidating={false}
          validatedAt={timestamp}
        />
      );

      // Should contain time in the pill
      expect(screen.getByText(/Validated at/)).toBeTruthy();
    });
  });

  describe('Mode Legend', () => {
    it('A-GR-05: renders all 4 mode tags in legend', () => {
      render(
        <ValidationStateHeader
          hasValidatorResult={false}
          isValidating={false}
          showLegend={true}
        />
      );

      expect(screen.getByText('Official (Validator)')).toBeTruthy();
      expect(screen.getByText('Setup')).toBeTruthy();
      expect(screen.getByText('Exploratory')).toBeTruthy();
      expect(screen.getByText('Debug')).toBeTruthy();
    });

    it('A-GR-06: hides legend when showLegend=false', () => {
      render(
        <ValidationStateHeader
          hasValidatorResult={false}
          isValidating={false}
          showLegend={false}
        />
      );

      expect(screen.queryByText('Mode legend:')).toBeNull();
    });
  });

  describe('ModeTag Component', () => {
    it('A-GR-07: renders correct label for OFFICIAL mode', () => {
      render(<ModeTag mode="OFFICIAL" />);
      expect(screen.getByText('Official (Validator)')).toBeTruthy();
    });

    it('A-GR-08: renders correct label for EXPLORATORY mode', () => {
      render(<ModeTag mode="EXPLORATORY" />);
      expect(screen.getByText('Exploratory')).toBeTruthy();
    });

    it('A-GR-09: renders correct label for DEBUG mode', () => {
      render(<ModeTag mode="DEBUG" />);
      expect(screen.getByText('Debug')).toBeTruthy();
    });

    it('A-GR-10: renders nothing for invalid mode', () => {
      const { container } = render(<ModeTag mode="INVALID" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('MODE_TAGS Constants', () => {
    it('A-GR-11: OFFICIAL tag has blue color class', () => {
      expect(MODE_TAGS.OFFICIAL.color).toContain('blue');
    });

    it('A-GR-12: SETUP tag has neutral color class', () => {
      expect(MODE_TAGS.SETUP.color).toContain('neutral');
    });

    it('A-GR-13: EXPLORATORY tag has amber color class', () => {
      expect(MODE_TAGS.EXPLORATORY.color).toContain('amber');
    });

    it('A-GR-14: DEBUG tag has purple color class', () => {
      expect(MODE_TAGS.DEBUG.color).toContain('purple');
    });
  });
});

describe('ValidationDetailsPanel Guardrail Tests (Tasks B, C, D, E)', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Hard-Gating Requirement (Task B)', () => {
    it('B-GR-01: shows callout when hasValidatorResult=false and panel is expanded', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={false}
          isValidating={false}
          snapshotValidationDetails={null}
          teams={mockTeams}
        />
      );

      // Expand the panel
      fireEvent.click(screen.getByText('Validation Results'));

      // Should show the not-validated callout
      const callout = screen.getByTestId('not-validated-callout');
      expect(callout).toBeTruthy();
      // Verify the callout contains the key text
      expect(callout.textContent).toContain('Validate Trade');
      expect(callout.textContent).toContain('to generate official results');
    });

    it('B-GR-02: does NOT show Official tags when hasValidatorResult=false', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={false}
          isValidating={false}
          snapshotValidationDetails={null}
          teams={mockTeams}
        />
      );

      // Expand the panel
      fireEvent.click(screen.getByText('Validation Results'));

      // Should NOT have Official tags visible
      expect(screen.queryByText('Official (Validator)')).toBeNull();
    });

    it('B-GR-03: shows validation details when hasValidatorResult=true', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={true}
          isValidating={false}
          previewAuthority={mockPreviewAuthority}
          snapshotValidationDetails={mockResult}
          teams={mockTeams}
          capProjections={mockCapProjections}
          yearKey={2025}
          salaryOut={[0, 0]}
          incomingAssets={[{ players: [], picks: [] }, { players: [], picks: [] }]}
          calculatorTeamIndex={0}
        />
      );

      // Expand the panel
      fireEvent.click(screen.getByText('Validation Results'));

      // Should show section headers
      expect(screen.getByText('Validation Summary')).toBeTruthy();
      expect(screen.getByText('Rule Compliance Overview')).toBeTruthy();
    });

    it('B-GR-04: button text is "Validation Results" (collapsible section header)', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={false}
          isValidating={false}
          snapshotValidationDetails={null}
          teams={mockTeams}
        />
      );

      expect(screen.getByText('Validation Results')).toBeTruthy();
    });
  });

  describe('Section Headers with Mode Tags (Tasks C, D)', () => {
    it('CD-GR-01: Validation Summary section has OFFICIAL tag when validated', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={true}
          isValidating={false}
          previewAuthority={mockPreviewAuthority}
          snapshotValidationDetails={mockResult}
          teams={mockTeams}
          capProjections={mockCapProjections}
          yearKey={2025}
          salaryOut={[0, 0]}
          incomingAssets={[{ players: [], picks: [] }, { players: [], picks: [] }]}
          calculatorTeamIndex={0}
        />
      );

      fireEvent.click(screen.getByText('Validation Results'));

      // Find Validation Summary section and check for Official tag
      const summarySection = screen.getByTestId('section-validation-summary');
      expect(summarySection.textContent).toContain('Official (Validator)');
    });

    it('CD-GR-02: Rule Compliance Overview section has OFFICIAL tag when validated', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={true}
          isValidating={false}
          previewAuthority={mockPreviewAuthority}
          snapshotValidationDetails={mockResult}
          teams={mockTeams}
          capProjections={mockCapProjections}
          yearKey={2025}
          salaryOut={[0, 0]}
          incomingAssets={[{ players: [], picks: [] }, { players: [], picks: [] }]}
          calculatorTeamIndex={0}
        />
      );

      fireEvent.click(screen.getByText('Validation Results'));

      const ruleSection = screen.getByTestId('section-rule-compliance');
      expect(ruleSection.textContent).toContain('Official (Validator)');
    });

    it('CD-GR-03: Trade Exception Analysis section has OFFICIAL tag when validated', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={true}
          isValidating={false}
          previewAuthority={mockPreviewAuthority}
          snapshotValidationDetails={mockResult}
          teams={mockTeams}
          capProjections={mockCapProjections}
          yearKey={2025}
          salaryOut={[0, 0]}
          incomingAssets={[{ players: [], picks: [] }, { players: [], picks: [] }]}
          calculatorTeamIndex={0}
        />
      );

      fireEvent.click(screen.getByText('Validation Results'));

      const exceptionSection = screen.getByTestId('section-exception-analysis');
      expect(exceptionSection.textContent).toContain('Official (Validator)');
    });

    it('CD-GR-04: Salary Calculator section has EXPLORATORY tag when validated', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={true}
          isValidating={false}
          previewAuthority={mockPreviewAuthority}
          snapshotValidationDetails={mockResult}
          teams={mockTeams}
          capProjections={mockCapProjections}
          yearKey={2025}
          salaryOut={[0, 0]}
          incomingAssets={[{ players: [], picks: [] }, { players: [], picks: [] }]}
          calculatorTeamIndex={0}
        />
      );

      // Salary Calculator is in the Development Tools panel
      fireEvent.click(screen.getByText('Development Tools'));

      const calculatorSection = screen.getByTestId('section-salary-calculator');
      expect(calculatorSection.textContent).toContain('Exploratory');
    });

    it('CD-GR-05: Trade Receipt section has DEBUG tag when validated', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={true}
          isValidating={false}
          previewAuthority={mockPreviewAuthority}
          snapshotValidationDetails={mockResult}
          teams={mockTeams}
          capProjections={mockCapProjections}
          yearKey={2025}
          salaryOut={[0, 0]}
          incomingAssets={[{ players: [], picks: [] }, { players: [], picks: [] }]}
          calculatorTeamIndex={0}
        />
      );

      // Trade Receipt is in the Development Tools panel
      fireEvent.click(screen.getByText('Development Tools'));

      const receiptSection = screen.getByTestId('section-trade-receipt');
      expect(receiptSection.textContent).toContain('Debug');
    });
  });

  describe('Section Order (Task C)', () => {
    it('C-GR-06: sections appear in correct order when validated', () => {
      const { container } = render(
        <ValidationDetailsPanel
          hasValidatorResult={true}
          isValidating={false}
          previewAuthority={mockPreviewAuthority}
          snapshotValidationDetails={mockResult}
          teams={mockTeams}
          capProjections={mockCapProjections}
          yearKey={2025}
          salaryOut={[0, 0]}
          incomingAssets={[{ players: [], picks: [] }, { players: [], picks: [] }]}
          calculatorTeamIndex={0}
        />
      );

      // Expand both panels to see all sections
      fireEvent.click(screen.getByText('Validation Results'));
      fireEvent.click(screen.getByText('Development Tools'));

      // Get all section test IDs in order
      const sections = container.querySelectorAll('[data-testid^="section-"]');
      const testIds = Array.from(sections).map(s => s.getAttribute('data-testid'));

      // Verify order: summary, rule-compliance, exception-analysis (Panel 1), then salary-calculator, trade-receipt (Panel 2)
      expect(testIds[0]).toBe('section-validation-summary');
      expect(testIds[1]).toBe('section-rule-compliance');
      expect(testIds[2]).toBe('section-exception-analysis');
      expect(testIds[3]).toBe('section-salary-calculator');
      expect(testIds[4]).toBe('section-trade-receipt');
    });
  });

  describe('Collapsible Behavior', () => {
    it('Panel is collapsed by default', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={true}
          isValidating={false}
          previewAuthority={mockPreviewAuthority}
          snapshotValidationDetails={mockResult}
          teams={mockTeams}
        />
      );

      // Content should not be visible initially
      expect(screen.queryByTestId('section-validation-summary')).toBeNull();
    });

    it('Panel shows "Results available" indicator when validated', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={true}
          isValidating={false}
          previewAuthority={mockPreviewAuthority}
          snapshotValidationDetails={mockResult}
          teams={mockTeams}
        />
      );

      expect(screen.getByText('✓ Results available')).toBeTruthy();
    });

    it('Panel does not show "Results available" when not validated', () => {
      render(
        <ValidationDetailsPanel
          hasValidatorResult={false}
          isValidating={false}
          snapshotValidationDetails={null}
          teams={mockTeams}
        />
      );

      expect(screen.queryByText('✓ Results available')).toBeNull();
    });
  });
});
