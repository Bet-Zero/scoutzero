import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PlayerHeadshot from '@/components/shared/PlayerHeadshot.jsx';

describe('PlayerHeadshot', () => {
  it('renders an img element', () => {
    const { container } = render(<PlayerHeadshot playerId="123" />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
  });
});
