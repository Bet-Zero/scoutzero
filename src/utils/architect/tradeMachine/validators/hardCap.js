import {
  isFirstApronTeam,
  isSecondApronTeam,
  getTeamSalary,
} from '../capHelpers.js';

export function validateHardCap(team, capSettings) {
  if (!team?.team || !capSettings) {
    return {
      passed: false,
      violations: ['Missing team or cap settings data'],
      hardCapType: null,
    };
  }

  const violations = [];
  let hardCapType = null;

  // Get total salary after trade
  const incomingSalary = (team.receives || []).reduce(
    (sum, p) => sum + p.newSalary,
    0
  );
  const outgoingSalary = (team.sends || []).reduce(
    (sum, p) => sum + p.newSalary,
    0
  );
  const projectedSalary =
    getTeamSalary(team.team) - outgoingSalary + incomingSalary;

  // Check first apron hard cap
  if (team.team.hardCapFirstApron?.active) {
    hardCapType = 'FirstApron';
    if (projectedSalary > capSettings.firstApron) {
      violations.push(
        `Trade would exceed 1st Apron hard cap by ${(projectedSalary - capSettings.firstApron).toLocaleString()}`
      );
    }
  }

  // Check second apron hard cap
  if (team.team.hardCapSecondApron?.active) {
    hardCapType = 'SecondApron';
    if (projectedSalary > capSettings.secondApron) {
      violations.push(
        `Trade would exceed 2nd Apron hard cap by ${(projectedSalary - capSettings.secondApron).toLocaleString()}`
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    hardCapType,
  };
}
