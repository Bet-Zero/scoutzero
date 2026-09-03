// @vitest-environment jsdom
/**
 * E2A TradeLegalChecker disclosure behavior tests
 *
 * Proves that the TradeLegalChecker component actually renders the disclosure
 * at the component level — not just as source text. This test is the behavioral
 * complement to the E2A guardrail test.
 *
 * TM-1A-FINAL update: post-state cap/roster is now in preview (getFullLegalityPreview),
 * so the footer no longer lists it as apply-only. Tests updated to match new text.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/validationIssueText',
  () => ({
    getValidationIssueText: (issue: unknown) => String(issue),
    normalizeValidationIssues: (issues: unknown) =>
      Array.isArray(issues) ? issues : [],
  })
);

import { TradeLegalChecker } from '@/features/architect/tradeMachine/TradeLegalChecker';

describe('E2A TradeLegalChecker disclosure rendering', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders the disclosure paragraph when teamResults is empty', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const disclosure = screen.getByText(
      /Final roster and draft-asset checks run when you apply the trade/i
    );
    expect(disclosure).toBeTruthy();
  });

  it('disclosure says the remaining checks run on apply', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const disclosure = screen.getByText(/when you apply the trade/i);
    expect(disclosure).toBeTruthy();
  });

  it('disclosure names roster and draft-asset checks', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const disclosure = screen.getByText(/roster and draft-asset checks/i);
    expect(disclosure).toBeTruthy();
  });

  it('disclosure does not expose the implementation exclusivity term', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toMatch(/exclusivity/i);
  });

  it('no rendered text implies guaranteed apply success', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toMatch(/guaranteed.*apply/i);
    expect(bodyText).not.toMatch(/apply.*guaranteed/i);
  });

  it('resolves independent player id and display-name fallbacks', () => {
    render(
      <TradeLegalChecker
        teamResults={[
          {
            teamName: 'Miami Heat',
            outgoingPlayers: [
              {
                player_id: 'legacy_player_id',
                id: 'player_1',
                name: 'player_1',
                fullName: 'Player One',
              },
            ],
            rules: {
              cash: {
                passed: false,
                violations: [
                  'player_1: This Contract has a trade bonus whose allocation is outside this governed tranche.',
                ],
              },
            },
          },
        ]}
      />
    );

    expect(
      screen.getByText(
        'Player One: Available contract information is insufficient to determine the trade-bonus allocation.'
      )
    ).toBeVisible();
    expect(document.body.textContent).not.toContain('player_1');
  });
});
