export function runOffseason(
  teamCapSheet,
  currentYear,
  capProjections,
  optionDecisions = {}
) {
  const nextYear = currentYear + 1;
  const updatedContracts = [];
  const expiredContracts = [];
  const declinedOptions = [];
  const expiredTPEs = [];
  const waivedDeadCap = [];

  const now = new Date(`${nextYear}-07-01`);

  // Process contracts
  const yearKey = nextYear;
  for (const contract of teamCapSheet.players) {
    const nextYearSalary =
      contract.contract_clean?.salaries_by_year?.[yearKey]?.salary;
    let isOptionDeclined = false;

    // Handle player options
    const optionType =
      contract.contract_clean?.salaries_by_year?.[yearKey]?.option;
    if (optionType === 'Player Option' || optionType === 'Team Option') {
      if (!optionDecisions[contract.name]) {
        isOptionDeclined = true;
        declinedOptions.push(contract.name);
      }
    }

    // Remove if no next year or option declined
    if (!nextYearSalary || isOptionDeclined) {
      expiredContracts.push(contract.name);
      continue;
    }

    updatedContracts.push(contract);
  }

  // Handle expired TPEs
  const activeTPEs = (teamCapSheet.tradeExceptions || []).filter((tpe) => {
    const expires = new Date(tpe.expires);
    const stillValid = expires > now;
    if (!stillValid) {
      expiredTPEs.push(tpe);
    }
    return stillValid;
  });

  // Track ongoing dead cap from waived contracts
  const updatedWaived = (teamCapSheet.waivedContracts || [])
    .map((contract) => {
      const remaining = {};
      for (const [year, amount] of Object.entries(contract.deadCap || {})) {
        if (parseInt(year) >= nextYear) {
          remaining[year] = amount;
          waivedDeadCap.push({
            name: contract.name,
            year,
            amount,
          });
        }
      }
      return Object.keys(remaining).length
        ? { ...contract, deadCap: remaining }
        : null;
    })
    .filter(Boolean);

  // Reset MLE
  const key = `${nextYear}-${String((nextYear + 1) % 100).padStart(2, '0')}`;
  const capData = capProjections[key] || {};
  const newMLE = {
    amount: capData.fullMLE || 0,
    used: 0,
  };

  // Update MLE history
  const currentMLE = teamCapSheet.mle || { amount: 0, used: 0 };
  const mleHistory = [
    ...(teamCapSheet.mleHistory || []),
    {
      year: currentYear,
      total: currentMLE.amount,
      used: currentMLE.used,
      remaining: currentMLE.amount - currentMLE.used,
    },
  ];

  // Return updated cap sheet and summary
  return {
    updatedCapSheet: {
      ...teamCapSheet,
      players: updatedContracts,
      tradeExceptions: activeTPEs,
      waivedContracts: updatedWaived,
      mle: newMLE,
      mleHistory,
      hardCapped: false, // Reset hard cap
    },
    summary: {
      declinedOptions,
      expiredContracts,
      expiredTPEs,
      waivedDeadCap,
      resetMLE: true,
    },
  };
}
