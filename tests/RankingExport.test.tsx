import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RankingExport,
  recommendedExportLayout,
  type ExportLayout,
} from '@/features/ranker/RankingExport';
import type { RankerPlayer } from '@/features/ranker/utils/rankingEngine';

const players = (count: number) =>
  Array.from(
    { length: count },
    (_, i) =>
      ({
        id: `p${i + 1}`,
        name: `First${i + 1} Last${i + 1}`,
        bio: { displayName: `First${i + 1} Last${i + 1}`, display: { teamId: 'BOS' } },
      }) as unknown as RankerPlayer
  );

describe('RankingExport', () => {
  afterEach(cleanup);

  it('recommends a layout that fits the list size', () => {
    expect(recommendedExportLayout(20)).toBe('cards');
    expect(recommendedExportLayout(42)).toBe('cards');
    expect(recommendedExportLayout(50)).toBe('compact');
    expect(recommendedExportLayout(60)).toBe('compact');
    expect(recommendedExportLayout(100)).toBe('featured');
  });

  it.each<ExportLayout>(['cards', 'compact', 'featured'])(
    'includes every player of a Top 100 in the %s layout',
    (layout) => {
      render(<RankingExport ranking={players(100)} layout={layout} title="My Top 100" />);
      expect(screen.getByText('My Top 100')).toBeTruthy();
      expect(screen.getByText(/100 players/)).toBeTruthy();
      // The last player is present (the old export stopped at 42)
      expect(screen.getAllByText(/Last100/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Last43/).length).toBeGreaterThan(0);
    }
  );

  it('features the top 10 as cards and numbers the rest down the columns', () => {
    render(<RankingExport ranking={players(100)} layout="featured" title="My Top 100" />);
    // Featured cards show the last name on its own line; rows show the full name
    expect(screen.getByText('Last10')).toBeTruthy();
    expect(screen.queryByText('First10 Last10')).toBeNull();
    expect(screen.getByText('First11 Last11')).toBeTruthy();
    const row = screen.getByText('First100 Last100').parentElement as HTMLElement;
    expect(row.textContent).toContain('100');
  });
});
