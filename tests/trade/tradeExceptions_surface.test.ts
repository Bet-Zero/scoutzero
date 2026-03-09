import { afterEach, describe, expect, it, vi } from 'vitest';
import * as persistenceContracts from '@/features/architect/utils/persistenceContracts';
import { validateTradeExceptions } from '@/features/architect/utils/tradeMachine/rules/tradeExceptions.js';

const futureDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 10);
  return date.toISOString();
};

const pastDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 10);
  return date.toISOString();
};

const makeLegacyTeam = ({
  totalSalary = 150_000_000,
  receives = [],
  sends = [],
  tpes = [],
}: {
  totalSalary?: number;
  receives?: Array<Record<string, unknown>>;
  sends?: Array<Record<string, unknown>>;
  tpes?: Array<Record<string, unknown>>;
} = {}) => ({
  team: {
    totalSalary,
    exceptions: { tpe: tpes },
  },
  receives,
  sends,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tradeExceptions surface', () => {
  it('keeps the no-TPE fast path result unchanged', () => {
    expect(
      validateTradeExceptions(
        makeLegacyTeam({
          receives: [{ absorptionMode: 'MATCH', matchIncoming: 4_000_000 }],
          sends: [{ salary: 2_000_000 }],
        }),
        { capSettings: { secondApron: 190_000_000 } }
      )
    ).toEqual({
      passed: true,
      violations: [],
      message: 'Trade exceptions validated',
      details: '',
    });
  });

  it('keeps the second-apron rejection unchanged', () => {
    expect(
      validateTradeExceptions(
        makeLegacyTeam({
          totalSalary: 220_000_000,
          receives: [
            {
              absorptionMode: 'TPE',
              tpeId: 'tpe-1',
              matchIncoming: 4_000_000,
            },
          ],
        }),
        { capSettings: { secondApron: 190_000_000 } }
      )
    ).toEqual({
      passed: false,
      violations: ['Teams above the Second Apron cannot use TPEs'],
      message: 'Teams above the Second Apron cannot use TPEs',
    });
  });

  it('keeps the invalid-TPE violation unchanged', () => {
    const result = validateTradeExceptions(
      makeLegacyTeam({
        receives: [
          {
            absorptionMode: 'TPE',
            tpeId: 'missing-tpe',
            matchIncoming: 4_000_000,
          },
        ],
        tpes: [{ id: 'available-tpe', remaining: 5_000_000 }],
      }),
      { capSettings: { secondApron: 190_000_000 } }
    );

    expect(result.violations).toEqual(['Invalid TPE specified']);
    expect(result.message).toBe('Invalid TPE specified');
  });

  it('keeps the already-in-use violation unchanged', () => {
    const result = validateTradeExceptions(
      makeLegacyTeam({
        receives: [
          {
            absorptionMode: 'TPE',
            tpeId: 'busy-tpe',
            matchIncoming: 4_000_000,
          },
        ],
        tpes: [
          {
            id: 'busy-tpe',
            remaining: 5_000_000,
            expirationDate: futureDate(),
            isUsed: true,
          },
        ],
      }),
      { capSettings: { secondApron: 190_000_000 } }
    );

    expect(result.violations).toEqual([
      'TPE is already being processed in another trade',
    ]);
  });

  it('keeps the expired-TPE violation unchanged', () => {
    const result = validateTradeExceptions(
      makeLegacyTeam({
        receives: [
          {
            absorptionMode: 'TPE',
            tpeId: 'expired-tpe',
            matchIncoming: 4_000_000,
          },
        ],
        tpes: [
          {
            id: 'expired-tpe',
            remaining: 5_000_000,
            expirationDate: pastDate(),
          },
        ],
      }),
      { capSettings: { secondApron: 190_000_000 } }
    );

    expect(result.violations).toEqual(['TPE has expired']);
  });

  it('keeps the insufficient-TPE violation unchanged', () => {
    const result = validateTradeExceptions(
      makeLegacyTeam({
        receives: [
          {
            absorptionMode: 'TPE',
            tpeId: 'small-tpe',
            matchIncoming: 4_000_000,
          },
        ],
        tpes: [
          {
            id: 'small-tpe',
            remaining: 3_000_000,
            expirationDate: futureDate(),
          },
        ],
      }),
      { capSettings: { secondApron: 190_000_000 } }
    );

    expect(result.violations).toEqual(['TPE is too small for incoming salary']);
  });

  it('keeps the outgoing-salary aggregation block unchanged', () => {
    const result = validateTradeExceptions(
      makeLegacyTeam({
        receives: [
          {
            absorptionMode: 'TPE',
            tpeId: 'usable-tpe',
            matchIncoming: 4_000_000,
          },
        ],
        sends: [{ salary: 2_000_000 }],
        tpes: [
          {
            id: 'usable-tpe',
            remaining: 6_000_000,
            expirationDate: futureDate(),
          },
        ],
      }),
      { capSettings: { secondApron: 190_000_000 } }
    );

    expect(result.violations).toEqual([
      'Cannot combine TPE with outgoing salary',
    ]);
  });

  it('mutates the resolved TPE object in place on successful usage', () => {
    const resolvedTpes = [
      {
        id: 'usable-tpe',
        remaining: 5_000_000,
        expirationDate: futureDate(),
      },
    ];
    vi.spyOn(persistenceContracts, 'getTeamTpeList').mockReturnValue(
      resolvedTpes
    );

    const result = validateTradeExceptions(
      makeLegacyTeam({
        receives: [
          {
            absorptionMode: 'TPE',
            tpeId: 'usable-tpe',
            matchIncoming: 4_000_000,
          },
        ],
      }),
      { capSettings: { secondApron: 190_000_000 } }
    );

    expect(result).toEqual({
      passed: true,
      violations: [],
      message: 'Trade exceptions validated',
      details: '',
    });
    expect(resolvedTpes[0].remaining).toBe(1_000_000);
    expect(resolvedTpes[0].isUsed).toBe(true);
  });
});
