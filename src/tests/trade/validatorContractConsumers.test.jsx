// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ValidationDetailsPanel from '@/features/architect/tradeMachine/ValidationDetailsPanel';
import { validateTradeExceptions as validateLegacyTradeExceptions } from '@/features/architect/utils/tradeMachine/rules/tradeExceptions';
import { createValidationIssue } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const issue = (message, rule, severity = 'error') =>
  createValidationIssue(message, { rule, severity });

afterEach(() => {
  cleanup();
});

const teams = [
  {
    team: {
      id: 'BOS',
      nickname: 'Celtics',
      teamName: 'Boston Celtics',
      tradeExceptions: [],
      faExceptionBuckets: [{ type: 'NTMLE', remaining: 6_000_000 }],
    },
    sends: [],
    entitlementsOut: [],
  },
  {
    team: {
      id: 'LAL',
      nickname: 'Lakers',
      teamName: 'Los Angeles Lakers',
      tradeExceptions: [],
      faExceptionBuckets: [],
    },
    sends: [],
    entitlementsOut: [],
  },
];

const result = {
  legal: false,
  authoritativeLegal: false,
  reason: 'Incoming exceeds allowable',
  violations: [issue('Incoming exceeds allowable', 'salaryMatching')],
  warnings: [issue('Trade-level warning', 'tradeValidation', 'warning')],
  yearKey: 2026,
  seasonKey: '2025-26',
  capSettings: {
    salaryCap: 154_000_000,
    firstApron: 178_132_000,
    secondApron: 188_931_000,
  },
  dataWarnings: [],
  hasDataIssues: false,
  summaryByTeamIndex: [
    {
      teamId: 'BOS',
      teamCode: 'BOS',
      teamName: 'Boston Celtics',
      playersOut: '',
      playersIn: ['Exception Wing'],
      capDelta: 5_000_000,
      legal: false,
      violations: [issue('Incoming exceeds allowable', 'salaryMatching')],
      warnings: [],
    },
    {
      teamId: 'LAL',
      teamCode: 'LAL',
      teamName: 'Los Angeles Lakers',
      playersOut: 'Exception Wing',
      playersIn: [],
      capDelta: -5_000_000,
      legal: true,
      violations: [],
      warnings: [],
    },
  ],
  teamResults: [
    {
      teamId: 'BOS',
      teamCode: 'BOS',
      teamName: 'Boston Celtics',
      legal: false,
      salaryIn: 5_000_000,
      salaryOut: 0,
      totalSalary: 170_000_000,
      projectedSalary: 175_000_000,
      hardCapped: true,
      apronStatus: 'Below Apron',
      faExceptionBuckets: [{ type: 'NTMLE', remaining: 6_000_000 }],
      incomingPlayers: [
        {
          id: 'exception-wing',
          player_id: 'exception-wing',
          name: 'Exception Wing',
          absorptionMode: 'FA_EXCEPTION',
          matchIncoming: 5_000_000,
        },
      ],
      outgoingPlayers: [],
      createdTPE: null,
      violations: [issue('Incoming exceeds allowable', 'salaryMatching')],
      warnings: [],
      rules: {
        salaryMatching: {
          passed: false,
          violations: [issue('Incoming exceeds allowable', 'salaryMatching')],
          warnings: [],
          message: 'Incoming exceeds allowable',
        },
        timingEnforcement: {
          passed: false,
          violations: [
            issue(
              'Player cannot be traded until January 15 (recent extension)',
              'timingEnforcement'
            ),
          ],
          warnings: [],
          message: 'Player cannot be traded until January 15 (recent extension)',
        },
        tradeExceptions: {
          passed: false,
          violations: [
            issue(
              'No TPE has sufficient capacity for Exception Wing',
              'tradeExceptions'
            ),
          ],
          warnings: [],
          message: 'No TPE has sufficient capacity for Exception Wing',
        },
        faExceptionUsage: {
          passed: false,
          violations: [
            issue(
              'Cannot combine FA Exception with outgoing salary',
              'faExceptionUsage'
            ),
          ],
          warnings: [
            issue(
              'FA exception usage would hard-cap the team',
              'faExceptionUsage',
              'warning'
            ),
          ],
          message: 'Cannot combine FA Exception with outgoing salary',
        },
      },
    },
    {
      teamId: 'LAL',
      teamCode: 'LAL',
      teamName: 'Los Angeles Lakers',
      legal: true,
      salaryIn: 0,
      salaryOut: 5_000_000,
      totalSalary: 150_000_000,
      projectedSalary: 145_000_000,
      hardCapped: false,
      apronStatus: 'Below Apron',
      faExceptionBuckets: [],
      incomingPlayers: [],
      outgoingPlayers: [
        {
          id: 'exception-wing',
          player_id: 'exception-wing',
          name: 'Exception Wing',
          salary: 5_000_000,
        },
      ],
      createdTPE: {
        amount: 5_000_000,
        createdAt: '2026-07-10T12:00:00.000Z',
      },
      violations: [],
      warnings: [],
      rules: {
        salaryMatching: {
          passed: true,
          violations: [],
          warnings: [],
          message: 'Salary matching validated',
        },
        tradeExceptions: {
          passed: true,
          violations: [],
          warnings: [],
          message: 'Trade exceptions validated',
        },
        faExceptionUsage: {
          passed: true,
          violations: [],
          warnings: [],
          message: 'FA exception usage validated',
        },
      },
    },
  ],
};

describe('validator contract consumers', () => {
  it('renders canonical validator blockers and warnings across official panels', () => {
    render(
      <ValidationDetailsPanel
        hasValidatorResult
        isValidating={false}
        result={result}
        teams={teams}
        capProjections={result.capSettings}
        yearKey={2026}
        salaryOut={[0, 0]}
        incomingAssets={[{ players: [], picks: [] }, { players: [], picks: [] }]}
        calculatorTeamIndex={0}
      />
    );

    fireEvent.click(screen.getByText('Validation Results'));

    expect(screen.getByText('Why it fails')).toBeTruthy();
    expect(screen.getAllByText('Incoming exceeds allowable').length).toBe(2);
    expect(
      screen.getByText('Player cannot be traded until January 15 (recent extension)')
    ).toBeTruthy();
    expect(screen.getByText('Trade Exception Blockers')).toBeTruthy();
    expect(
      screen.getAllByText('No TPE has sufficient capacity for Exception Wing')
        .length
    ).toBe(2);
    expect(screen.getByText('FA Exception Blockers')).toBeTruthy();
    expect(
      screen.getAllByText('Cannot combine FA Exception with outgoing salary')
        .length
    ).toBeGreaterThan(0);
    expect(screen.getByText('FA Exception Warnings')).toBeTruthy();
    expect(
      screen.getAllByText('FA exception usage would hard-cap the team').length
    ).toBeGreaterThan(0);
  });

  it('renders legacy tradeExceptions string violations unchanged through the official consumer path', () => {
    const legacyTradeExceptionsResult = validateLegacyTradeExceptions(
      {
        team: {
          totalSalary: 150_000_000,
          exceptions: {
            tpe: [
              {
                id: 'legacy-small-tpe',
                remaining: 3_000_000,
                expirationDate: '2099-01-01T00:00:00.000Z',
              },
            ],
          },
        },
        receives: [
          {
            name: 'Legacy Exception Wing',
            absorptionMode: 'TPE',
            tpeId: 'legacy-small-tpe',
            matchIncoming: 5_000_000,
          },
        ],
        sends: [],
      },
      {
        capSettings: {
          secondApron: 190_000_000,
        },
      }
    );

    const legacyIssues = legacyTradeExceptionsResult.violations.map((message) =>
      issue(message, 'tradeExceptions')
    );
    const legacyConsumerResult = {
      ...result,
      teamResults: [
        {
          ...result.teamResults[0],
          incomingPlayers: [
            {
              id: 'legacy-exception-wing',
              player_id: 'legacy-exception-wing',
              name: 'Legacy Exception Wing',
              absorptionMode: 'TPE',
              matchIncoming: 5_000_000,
            },
          ],
          rules: {
            ...result.teamResults[0].rules,
            tradeExceptions: {
              passed: legacyTradeExceptionsResult.passed,
              violations: legacyIssues,
              warnings: [],
              message: legacyTradeExceptionsResult.message,
              details: legacyTradeExceptionsResult.details || '',
            },
          },
        },
        result.teamResults[1],
      ],
    };

    render(
      <ValidationDetailsPanel
        hasValidatorResult
        isValidating={false}
        result={legacyConsumerResult}
        teams={teams}
        capProjections={legacyConsumerResult.capSettings}
        yearKey={2026}
        salaryOut={[0, 0]}
        incomingAssets={[{ players: [], picks: [] }, { players: [], picks: [] }]}
        calculatorTeamIndex={0}
      />
    );

    fireEvent.click(screen.getByText('Validation Results'));

    expect(screen.getByText('Trade Exception Blockers')).toBeTruthy();
    expect(
      screen.getAllByText('TPE is too small for incoming salary').length
    ).toBeGreaterThan(0);
  });
});
