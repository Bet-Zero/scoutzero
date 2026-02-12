import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EntitlementPickRow from '@/features/architect/tradeMachine/EntitlementPickRow';

vi.mock('@/features/architect/utils/entitlements/formatEntitlement', () => ({
  formatEntitlementLabel: () => 'BOS 2027 1st',
  getEntitlementKindTag: () => ({
    label: 'Own',
    colorClass: 'bg-blue-900/30 text-blue-300',
  }),
}));

vi.mock(
  '@/features/architect/utils/entitlements/entitlementPickRowProjection',
  () => ({
    projectEntitlementToPickRow: (entitlement) => ({
      year: entitlement.seasonYear,
      round: entitlement.round,
    }),
    getPickRowDisplayLabel: () => 'BOS 2027 1st',
    getPickRowSecondaryText: () => '',
  })
);

describe('EntitlementPickRow vacuum badges', () => {
  it('shows Session-only badge and delete action for vacuum entitlements', () => {
    render(
      <EntitlementPickRow
        entitlement={{
          id: 'vacuum:BOS:2028:1:own:abcd1234',
          holderTeam: 'BOS',
          seasonYear: 2028,
          round: 1,
          kind: 'pick_ownership',
          __vacuumSessionOnly: true,
        }}
        teamId="BOS"
        isVacuumMode
        onDeleteSessionPickRight={vi.fn()}
      />
    );

    expect(screen.getByText('Session-only')).toBeInTheDocument();
    expect(
      screen.getByText('Delete this session pick right')
    ).toBeInTheDocument();
  });

  it('shows Edited (this session) badge and revert action for edited base entitlements', () => {
    render(
      <EntitlementPickRow
        entitlement={{
          id: 'ent:BOS:2027:1:own:base1',
          holderTeam: 'BOS',
          seasonYear: 2027,
          round: 1,
          kind: 'pick_ownership',
          __vacuumEdited: true,
        }}
        teamId="BOS"
        isVacuumMode
        onRevertEdit={vi.fn()}
      />
    );

    expect(screen.getByText('Edited (this session)')).toBeInTheDocument();
    expect(screen.getByText('Revert this edit')).toBeInTheDocument();
  });
});
