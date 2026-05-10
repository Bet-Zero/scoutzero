import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EntitlementPickRow } from '@/features/architect/tradeMachine/EntitlementPickRow';

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
    projectEntitlementToPickRow: (entitlement: {
      seasonYear: number;
      round: number;
    }) => ({
      year: entitlement.seasonYear,
      round: entitlement.round,
    }),
    getPickRowDisplayLabel: () => 'BOS 2027 1st',
    getPickRowSecondaryText: () => '',
  })
);

const vacuumSessionEntitlementId = 'vacuum:BOS:2028:1:own:abcd1234';
const baseEntitlementId = 'ent:BOS:2027:1:own:base1';

describe('EntitlementPickRow vacuum badges', () => {
  it('shows Session-only badge and delete action for vacuum entitlements', () => {
    const setOpenMenu = vi.fn();
    render(
      <EntitlementPickRow
        entitlement={{
          id: vacuumSessionEntitlementId,
          holderTeam: 'BOS',
          seasonYear: 2028,
          round: 1,
          kind: 'pick_ownership',
          __vacuumSessionOnly: true,
        }}
        teamId="BOS"
        isVacuumMode
        onDeleteSessionPickRight={vi.fn()}
        openMenu={vacuumSessionEntitlementId}
        setOpenMenu={setOpenMenu}
      />
    );

    expect(screen.getByText('Session-only')).toBeInTheDocument();
    expect(
      screen.getByText('Delete this session pick right')
    ).toBeInTheDocument();
  });

  it('shows Edited (this session) badge and revert action for edited base entitlements', () => {
    const setOpenMenu = vi.fn();
    render(
      <EntitlementPickRow
        entitlement={{
          id: baseEntitlementId,
          holderTeam: 'BOS',
          seasonYear: 2027,
          round: 1,
          kind: 'pick_ownership',
          __vacuumEdited: true,
        }}
        teamId="BOS"
        isVacuumMode
        onRevertEdit={vi.fn()}
        openMenu={baseEntitlementId}
        setOpenMenu={setOpenMenu}
      />
    );

    expect(screen.getByText('Edited (this session)')).toBeInTheDocument();
    expect(screen.getByText('Revert this edit')).toBeInTheDocument();
  });
});
