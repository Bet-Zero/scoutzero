/** Principal-term and Arenas validation for governed RFA Offer Sheets. */

import type {
  GovernedOfferSheetEvidence,
  GovernedOfferSheetProposal,
} from '@/schemas/governedOfferSheet';
import type { ArchitectMutationContract } from '@/features/architect/utils/mutationPipeline';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import { canonicalizeOptionType } from '@/shared/utils/contracts/optionType';

export interface GovernedOfferSheetTermResult {
  readonly reasons: readonly string[];
  readonly offeringReservations: readonly { season: string; amount: number }[];
  readonly averageAnnualSalary: number;
  readonly isArenas: boolean;
  readonly firstYearMatchAmount: number;
}

export function governedOfferSheetBonusTotal(
  row: GovernedOfferSheetProposal['salariesByYear'][number],
  classification?: 'likely' | 'unlikely'
): number {
  return row.bonuses
    .filter(
      (bonus) => !classification || bonus.classification === classification
    )
    .reduce((sum, bonus) => sum + bonus.amount, 0);
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function validateProposalAgainstContract(
  proposal: GovernedOfferSheetProposal,
  contract: ArchitectMutationContract,
  reasons: string[]
) {
  const contractRows = contract.salariesByYear ?? [];
  if (contractRows.length !== proposal.salariesByYear.length) {
    reasons.push('Principal Terms must match every Contract Salary Cap Year.');
    return;
  }
  for (const [index, row] of proposal.salariesByYear.entries()) {
    const contractRow = contractRows[index];
    const contractLikely = Number(contractRow?.incentives?.likely ?? 0);
    const contractUnlikely = Number(contractRow?.incentives?.unlikely ?? 0);
    if (
      contractRow?.season !== row.season ||
      Number(contractRow.salary ?? contractRow.capHit) !== row.regularSalary ||
      contractLikely !== governedOfferSheetBonusTotal(row, 'likely') ||
      contractUnlikely !== governedOfferSheetBonusTotal(row, 'unlikely') ||
      contractRow.guaranteed !==
        (row.guaranteedForLackOfSkill &&
          row.guaranteedForInjuryOrIllness &&
          !row.individuallyNegotiatedProtectionConditions) ||
      canonicalizeOptionType(contractRow.option ?? contractRow.optionType) !==
        row.option
    ) {
      reasons.push(
        `Principal Terms do not match the saved Contract in Season ${row.season}.`
      );
    }
  }
}

function validateAnnualChange(
  first: number,
  second: number,
  label: string,
  reasons: string[]
) {
  if (Math.abs(second - first) > money(first * 0.05)) {
    reasons.push(`Second-year ${label} changes by more than 5%.`);
  }
}

function validateArenas(
  proposal: GovernedOfferSheetProposal,
  evidence: GovernedOfferSheetEvidence,
  reasons: string[]
) {
  const [first, second, third, fourth] = proposal.salariesByYear;
  if (!first || !second) {
    reasons.push('A one- or two-YOS Offer Sheet needs at least two Seasons.');
    return;
  }
  if (
    first.regularSalary + governedOfferSheetBonusTotal(first, 'unlikely') >
    evidence.league.nonTaxpayerMle
  ) {
    reasons.push('First-year Salary plus Unlikely Bonuses exceeds the NTMLE.');
  }
  validateAnnualChange(
    first.salaryExcludingIncentive,
    second.salaryExcludingIncentive,
    'Salary excluding Incentive Compensation',
    reasons
  );
  validateAnnualChange(
    first.regularSalary,
    second.regularSalary,
    'Regular Salary',
    reasons
  );
  const firstBonuses = new Map(
    first.bonuses.map((bonus) => [bonus.bonusId, bonus])
  );
  const secondBonuses = new Map(
    second.bonuses.map((bonus) => [bonus.bonusId, bonus])
  );
  if (firstBonuses.size !== secondBonuses.size) {
    reasons.push(
      'Every first-year bonus must have one second-year counterpart.'
    );
  }
  for (const [bonusId, firstBonus] of firstBonuses) {
    const secondBonus = secondBonuses.get(bonusId);
    if (
      !secondBonus ||
      secondBonus.classification !== firstBonus.classification
    ) {
      reasons.push(
        `Bonus ${bonusId} is missing or changes classification in Year 2.`
      );
    } else {
      validateAnnualChange(
        firstBonus.amount,
        secondBonus.amount,
        `bonus ${bonusId}`,
        reasons
      );
    }
  }
  if (third) {
    const thirdYearMaximum = evidence.league.maximumSalaryBySeason.find(
      (row) => row.season === third.season
    )?.amount;
    const hasJump = third.regularSalary > money(second.regularSalary * 1.05);
    const firstPermittedAmount =
      first.regularSalary + governedOfferSheetBonusTotal(first, 'unlikely');
    const secondPermittedAmount =
      second.regularSalary + governedOfferSheetBonusTotal(second, 'unlikely');
    if (
      hasJump &&
      (firstPermittedAmount !== evidence.league.arenasYearOneMaximum ||
        secondPermittedAmount !== evidence.league.arenasYearTwoMaximum)
    ) {
      reasons.push(
        'A third-year Arenas jump requires the maximum permitted first two Seasons.'
      );
    }
    if (thirdYearMaximum == null) {
      reasons.push('The third-year offering Team maximum is missing.');
    } else if (third.regularSalary > thirdYearMaximum) {
      reasons.push('Third-year Salary exceeds the offering Team maximum.');
    }
  }
  if (
    third &&
    fourth &&
    Math.abs(fourth.regularSalary - third.regularSalary) >
      money(third.regularSalary * 0.045)
  ) {
    reasons.push(
      'Fourth-year Salary changes by more than 4.5% of third-year Regular Salary.'
    );
  }
  for (const row of [third, fourth].filter(Boolean)) {
    if (
      governedOfferSheetBonusTotal(row!) !== 0 ||
      !row!.guaranteedForLackOfSkill ||
      !row!.guaranteedForInjuryOrIllness ||
      row!.individuallyNegotiatedProtectionConditions ||
      row!.option !== null
    ) {
      reasons.push(
        'Arenas Years 3 and 4 must have no bonuses or options and full unconditional protection.'
      );
    }
  }
}

export function validateGovernedOfferSheetTerms({
  proposal,
  evidence,
  contract,
}: {
  proposal: GovernedOfferSheetProposal;
  evidence: GovernedOfferSheetEvidence;
  contract: ArchitectMutationContract;
}): GovernedOfferSheetTermResult {
  const reasons: string[] = [];
  validateProposalAgainstContract(proposal, contract, reasons);
  for (const row of proposal.salariesByYear) {
    if (
      new Set(row.bonuses.map((bonus) => bonus.bonusId)).size !==
      row.bonuses.length
    ) {
      reasons.push(
        `Principal Terms contain duplicate bonus IDs in Season ${row.season}.`
      );
    }
  }
  for (const [index, row] of proposal.salariesByYear.entries()) {
    const expectedSeason = toSeasonCode(evidence.salaryCapYear + index);
    if (row.season !== expectedSeason) {
      reasons.push(
        `Principal Terms must use consecutive Salary Cap Years beginning with ${toSeasonCode(evidence.salaryCapYear)}.`
      );
      break;
    }
  }
  const guaranteedSeasons = proposal.salariesByYear.filter(
    (row) =>
      row.option === null &&
      row.guaranteedForLackOfSkill &&
      row.guaranteedForInjuryOrIllness &&
      !row.individuallyNegotiatedProtectionConditions
  ).length;
  const minimumSeasons =
    evidence.qualifyingOffer.requiredOfferSheetGuaranteedSeasons;
  if (guaranteedSeasons < minimumSeasons) {
    reasons.push(
      `This Offer Sheet requires at least ${minimumSeasons} fully protected Seasons excluding options.`
    );
  }
  const isArenas =
    evidence.eligibility.yearsOfService >= 1 &&
    evidence.eligibility.yearsOfService <= 2;
  if (isArenas) validateArenas(proposal, evidence, reasons);
  const total = proposal.salariesByYear.reduce(
    (sum, row) =>
      sum + row.salaryExcludingIncentive + governedOfferSheetBonusTotal(row),
    0
  );
  const averageAnnualSalary = money(total / proposal.salariesByYear.length);
  const first = proposal.salariesByYear[0];
  const firstYearMatchAmount = first
    ? first.salaryExcludingIncentive + governedOfferSheetBonusTotal(first)
    : 0;
  return Object.freeze({
    reasons: Object.freeze(reasons),
    offeringReservations: Object.freeze(
      proposal.salariesByYear.map((row) =>
        Object.freeze({
          season: row.season,
          amount: isArenas ? averageAnnualSalary : row.regularSalary,
        })
      )
    ),
    averageAnnualSalary,
    isArenas,
    firstYearMatchAmount,
  });
}
