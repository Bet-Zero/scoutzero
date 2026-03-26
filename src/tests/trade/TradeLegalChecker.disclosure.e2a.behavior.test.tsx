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

import TradeLegalChecker from '@/features/architect/tradeMachine/TradeLegalChecker';

describe('E2A TradeLegalChecker disclosure rendering', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders the disclosure paragraph when teamResults is empty', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const disclosure = screen.getByText(
      /Preview covers CBA validator/i
    );
    expect(disclosure).toBeTruthy();
  });

  it('disclosure mentions apply time', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const disclosure = screen.getByText(/apply time/i);
    expect(disclosure).toBeTruthy();
  });

  it('disclosure mentions world-state checks', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const disclosure = screen.getByText(/World-state checks/i);
    expect(disclosure).toBeTruthy();
  });

  it('disclosure mentions exclusivity as an apply-only check', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toMatch(/exclusivity/i);
  });

  it('no rendered text implies guaranteed apply success', () => {
    render(<TradeLegalChecker teamResults={[]} />);
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toMatch(/guaranteed.*apply/i);
    expect(bodyText).not.toMatch(/apply.*guaranteed/i);
  });
});
