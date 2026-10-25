import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CapConfidenceBadge,
  capFigureConfidence,
} from '@/features/architect/capSheet/CapConfidenceBadge';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';

describe('BZE-329 annual figure confidence', () => {
  it('labels the approved annual figures Official without certifying player minimums', () => {
    const rules = getCapRulesForYear(2026);
    expect(rules._meta.sources.salaries.rookieMin).toBe('projected');
    const summary = capFigureConfidence(
      2026,
      rules.cap,
      rules._meta.sources,
      rules._meta.sourcesSummary
    );
    render(<CapConfidenceBadge prefix="2025-26 cap ·" summary={summary} />);
    expect(screen.getByTestId('cap-confidence-badge').textContent).toBe(
      '2025-26 cap · Official'
    );
    expect(rules.salaries.rookieMinSource).toBe('projected');
  });

  it('keeps changed or projected custom figures outside the exception', () => {
    const rules = getCapRulesForYear(2026);
    expect(
      capFigureConfidence(
        2026,
        { ...rules.cap, salaryCap: 1 },
        rules._meta.sources,
        'projected'
      )
    ).toBe('projected');
    expect(
      capFigureConfidence(
        2026,
        rules.cap,
        { cap: { ...rules._meta.sources.cap, firstApron: 'projected' } },
        'projected'
      )
    ).toBe('projected');
    expect(capFigureConfidence(2026, rules.cap, null, 'unknown')).toBe(
      'unknown'
    );
  });

  it('does not change another season or its confidence metadata', () => {
    const rules = getCapRulesForYear(2026);
    expect(
      capFigureConfidence(2027, rules.cap, rules._meta.sources, 'projected')
    ).toBe('projected');
    expect(rules._meta.sourcesSummary).toBe('projected');
  });
});
