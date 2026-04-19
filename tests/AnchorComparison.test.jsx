import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnchorComparison } from '@/features/ranker/AnchorComparison';

const players = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
];
const anchor = { id: '3', name: 'Gamma' };

describe('AnchorComparison', () => {
  it('submits better player selections', () => {
    const handle = vi.fn();
    render(<AnchorComparison anchor={anchor} players={players} onComplete={handle} />);
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('Confirm'));
    expect(handle).toHaveBeenCalledWith(['1']);
  });
});
