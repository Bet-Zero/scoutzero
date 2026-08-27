import assert from 'node:assert/strict';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien';

/**
 * BZE-265 exact-head discriminator for the owner-locked 2026-08-27 boundary.
 *
 * Expectation oracle (recorded before product execution):
 * - accepted Canon: 6cf8aaf358c158a88e630e8a7336f7e9c3febc17 /
 *   sha256:23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76
 * - required leaves: CBA2-L09.2, CBA2-L09.3, CBA2-L09.6, CBA2-A12.4
 * - `npm run architect:canon:lookup -- CBA2-A12.3` returns no accepted leaf
 * - no authenticated branch-complete ownership, protection, conveyance,
 *   freeze, unfreeze, or penalty history is supplied below
 *
 * Therefore the first-round scenario must fail closed. The second-round
 * control is outside the unavailable Stepien/frozen-pick authority and must
 * remain supported. Neither expectation is derived from application output.
 */

const missingAuthorityFirstRound = {
  id: 'LAL_2027_R1',
  entitlementId: 'LAL_2027_R1',
  kind: 'pick_ownership',
  holderTeam: 'LAL',
  originalTeam: 'LAL',
  seasonYear: 2027,
  round: 1,
  underlyingStatus: 'clean',
};

const supportedSecondRound = {
  id: 'LAL_2027_R2',
  entitlementId: 'LAL_2027_R2',
  kind: 'pick_ownership',
  holderTeam: 'LAL',
  originalTeam: 'LAL',
  seasonYear: 2027,
  round: 2,
  underlyingStatus: 'clean',
};

const context = { year: 2026, yearKey: 2026 };

const unsupported = validateStepien(
  {
    teamId: 'LAL',
    team: { id: 'LAL', teamCode: 'LAL' },
    validationEntitlements: [missingAuthorityFirstRound],
    entitlementsOut: [missingAuthorityFirstRound],
  },
  context
);

const supported = validateStepien(
  {
    teamId: 'LAL',
    team: { id: 'LAL', teamCode: 'LAL' },
    validationEntitlements: [supportedSecondRound],
    entitlementsOut: [supportedSecondRound],
  },
  context
);

process.stdout.write(
  `${JSON.stringify({ unsupported, supported }, null, 2)}\n`
);

assert.equal(
  unsupported.passed,
  false,
  'missing CBA2-A12.3 and branch-complete first-round history must fail closed'
);
assert.equal(
  supported.passed,
  true,
  'the supported second-round control must remain functional'
);
