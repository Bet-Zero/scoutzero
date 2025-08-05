import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnchorComparison } from '@/features/ranker/AnchorComparison.jsx';

const players = [
  { id: '1', display_name: 'Alpha' },
  { id: '2', display_name: 'Beta' },
];
const anchor = { id: '3', display_name: 'Gamma' };

describe('AnchorComparison', () => {
  it('submits better player selections', () => {
    const handle = vi.fn();
    render(<AnchorComparison anchor={anchor} players={players} onComplete={handle} />);
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('Confirm'));
    expect(handle).toHaveBeenCalledWith(['1']);
  });
});
