// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { HistoryDetailModal } from '@/features/architect/history/TeamHistoryTab/HistoryDetailModal';
import type { TeamHistorySelectedEntry } from '@/features/architect/history/TeamHistoryTab/types';

afterEach(cleanup);
it('shows the GM trade summary while keeping technical receipt details out of the saved view', () => {
  const selected: TeamHistorySelectedEntry = {
    activeTeamCode: 'PHI',
    timelineSourceKey: 'world-events',
    truthKind: 'authoritative-world-event',
    entry: {
      id: 'saved-trade',
      type: 'Trade Executed',
      mutationType: 'executeTrade',
      teamCodes: ['PHI', 'BKN'],
      detailSections: [
        {
          title: 'Trade Receipt',
          presentation: 'trade-summary',
          lines: [
            'Tyrese Maxey Contract moved to Brooklyn.',
            'PHI 2028 first: final pick 5.',
          ],
        },
        { title: 'Execution Receipt', lines: ['Internal receipt field'] },
        { title: 'Salary Books', lines: ['Internal book field'] },
      ],
    },
  };
  const { rerender } = render(
    <HistoryDetailModal selectedEntry={selected} onClose={() => {}} />
  );
  expect(screen.getByText('Trade Receipt')).toBeVisible();
  expect(
    screen.getByText(/Tyrese Maxey Contract moved to Brooklyn\./)
  ).toBeVisible();
  expect(
    screen.getByText(/Philadelphia 76ers 2028 first: final pick 5\./)
  ).toBeVisible();
  expect(screen.queryByText('Internal receipt field')).not.toBeInTheDocument();
  expect(screen.queryByText('Internal book field')).not.toBeInTheDocument();
  delete selected.entry.detailSections![0].presentation;
  rerender(<HistoryDetailModal selectedEntry={selected} onClose={() => {}} />);
  expect(screen.queryByText('Trade Receipt')).not.toBeInTheDocument();
});
