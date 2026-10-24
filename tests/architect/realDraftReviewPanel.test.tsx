import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RealDraftReviewPanel } from '@/features/architect/tradeMachine/RealDraftReviewPanel';

const mock = vi.hoisted(() => ({ state: null as any }));
vi.mock('@/features/architect/tradeMachine/useRealDraftReview', () => ({
  useRealDraftReview: () => mock.state,
}));
const guard =
  'The retained pick evidence does not establish this world’s date. Review the starting position or supply dated changes.';
function fixture() {
  const row = {
    entitlementId: 'public-pick',
    label: 'Public qualified pick',
    role: 'original',
    status: 'needs-input',
    reason: guard,
    evidence: [],
    blockers: [],
    components: null,
  };
  const review = {
    apply: 'blocked',
    tradingVerdict: 'not-evaluated',
    asOf: '2030-06-05T00:00:00Z',
    records: [row],
  };
  return {
    key: 'public-state',
    review,
    startingPositionReview: {
      ...review,
      scope: 'retained-starting-position',
      records: [
        {
          ...row,
          reason: 'Historical qualified ownership only.',
          components: {
            status: 'reviewed',
            ownership: { status: 'component-permits' },
            apron: [],
          },
        },
      ],
    },
  };
}
const panel = () => (
  <RealDraftReviewPanel state={mock.state} />
);
afterEach(cleanup);
describe('explicit starting-position inspection preserves the dated-world boundary', () => {
  it('requires explicit inspection and returns to the unchanged fail-closed review', () => {
    mock.state = fixture();
    render(panel());
    expect(screen.getByText(guard)).toBeTruthy();
    expect(screen.queryByText(/Supported for this team/)).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Inspect retained starting position' })
    );
    expect(
      screen.getByText(/Recorded ownership: Supported for this team/)
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Historical starting position only. Missing or different world dates remain unverified.'
      )
    ).toBeTruthy();
    expect(screen.getByText(/Apply unavailable/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Return to date-limited review' })
    );
    expect(screen.getByText(guard)).toBeTruthy();
    expect(screen.queryByText(/Supported for this team/)).toBeNull();
  });
  it('does not reuse explicit inspection after a result change or cancel/restage with the same key', () => {
    mock.state = fixture();
    const view = render(panel());
    fireEvent.click(
      screen.getByRole('button', { name: 'Inspect retained starting position' })
    );
    mock.state = fixture();
    view.rerender(panel());
    expect(screen.queryByText(/Supported for this team/)).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Inspect retained starting position' })
    );
    mock.state = null;
    view.rerender(panel());
    expect(screen.queryByTestId('real-draft-review')).toBeNull();
    mock.state = fixture();
    view.rerender(panel());
    expect(screen.queryByText(/Supported for this team/)).toBeNull();
  });
  it('preserves actual loading/unavailable labels and Apply safeguards without an inspection affordance', () => {
    mock.state = { key: 'public-state', loading: true };
    const view = render(panel());
    expect(screen.getByText('Reading retained pick evidence…')).toBeTruthy();
    mock.state = {
      key: 'public-state',
      error:
        'The retained pick review is unavailable. First-round trades still need a complete review.',
    };
    view.rerender(panel());
    expect(
      screen.getByText(/retained pick review is unavailable/)
    ).toBeTruthy();
    expect(screen.getByText(/Apply unavailable/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
