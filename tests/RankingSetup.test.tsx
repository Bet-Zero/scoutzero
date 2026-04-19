import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RankingSetup } from '@/features/ranker/RankingSetup';

const samplePlayers = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
];

describe('RankingSetup', () => {
  it('captures selections and submits', () => {
    const handle = vi.fn();
    render(<RankingSetup playerPool={samplePlayers} onComplete={handle} />);
    const tierSection = screen.getByTestId('tier-tagging');
    // Click the TOP button for "Alpha" to mark as top-tier
    const topButtons = within(tierSection).getAllByText('TOP');
    fireEvent.click(topButtons[0]);
    fireEvent.click(screen.getByText(/Start/));
    expect(handle).toHaveBeenCalledWith({
      topTier: ['1'],
      bottomTier: [],
      anchor: null,
      firstPlace: null,
      lastPlace: null,
    });
  });
});
