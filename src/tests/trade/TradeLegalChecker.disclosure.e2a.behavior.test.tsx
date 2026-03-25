// @vitest-environment jsdom
/**
 * E2A TradeLegalChecker disclosure behavior tests
 *
 * Proves that the TradeLegalChecker component actually renders the E2 fallback
 * disclosure at the component level — not just as source text. This test is
 * the behavioral complement to the E2A guardrail test.
 *
 * TradeLegalChecker renders cleanly with empty teamResults because the
 * validationIssueText utilities are only called inside the teamResults.map() —
 * not during top-level render. We mock them as a precaution.
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

import TradeLegalChecker from '@/features/architect/tradeMachine/TradeLegalChecker';

describe('E2A TradeLegalChecker disclosure rendering', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders the disclosure paragraph when teamResults is empty', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const disclosure = screen.getByText(
      /Preview covers CBA validator rules only/i
    );
    expect(disclosure).toBeTruthy();
  });

  it('disclosure mentions apply time', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const disclosure = screen.getByText(/apply time/i);
    expect(disclosure).toBeTruthy();
  });

  it('disclosure mentions post-state cap/roster integrity', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const disclosure = screen.getByText(/post-state/i);
    expect(disclosure).toBeTruthy();
  });

  it('disclosure mentions world-state checks', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const disclosure = screen.getByText(/World-state checks/i);
    expect(disclosure).toBeTruthy();
  });

  it('no rendered text implies guaranteed apply success', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toMatch(/guaranteed.*apply/i);
    expect(bodyText).not.toMatch(/apply.*guaranteed/i);
  });
});
