import React from 'react';

const PlayerContractMini = ({
  contract = {},
  bird_rights = 'Unknown',
  option_type = {},
  free_agent_year,
  free_agent_type,
  currentContractView, // Accept denormalized view
}) => {
  const today = new Date();
  const CURRENT_YEAR = today.getFullYear() - (today.getMonth() < 6 ? 1 : 0);

  // Prioritize currentContractView (denormalized), fallback to contract.salariesByYear array
  let allSalaries = {};
  
  if (currentContractView?.salaryByYear) {
    // Convert object to array format
    Object.entries(currentContractView.salaryByYear).forEach(([year, salary]) => {
      const yearNum = parseInt(year, 10);
      if (yearNum >= CURRENT_YEAR && typeof salary === 'number') {
        allSalaries[yearNum] = { year: yearNum, salary };
      }
    });
  } else {
    // Fallback to contract.salariesByYear array
    const salaries = contract?.salariesByYear || [];
    allSalaries = salaries.reduce(
      (acc, salary) => {
        const year = salary.year || (salary.season ? parseInt(salary.season.split('-')[0]) + 1 : null);
        if (year && year >= CURRENT_YEAR) {
          acc[year] = salary;
        }
        return acc;
      },
      {}
    );
  }
  
  // Use free agent info from currentContractView if available
  const effectiveFreeAgentYear = free_agent_year || currentContractView?.freeAgentYear;
  const effectiveFreeAgentType = free_agent_type || currentContractView?.freeAgentType;

  // Generate exactly 5 seasons (current year + 4 future years)
  const displaySeasons = Array.from({ length: 5 }, (_, i) => {
    const year = CURRENT_YEAR + i;
    const salaryData = allSalaries[year];

    // Determine option type
    let optionType = null;
    if (salaryData?.option) {
      optionType = salaryData.option;
    } else if (option_type?.year === year) {
      optionType = option_type.type;
    }

    // Determine free agency status
    let freeAgentTag = null;
    if (year === effectiveFreeAgentYear) {
      freeAgentTag = effectiveFreeAgentType;
    }

    return {
      year,
      amount: salaryData?.salary || null,
      optionType,
      freeAgentTag,
      isExtensionYear: contract?.isExtension && salaryData,
    };
  });

  const getAmountColor = (optionType) => {
    if (optionType === 'Player Option') return 'text-green-500';
    if (optionType === 'Team Option') return 'text-orange-400';
    return 'text-white';
  };

  const getTagColor = (type) => {
    if (type === 'UFA') return 'bg-blue-600';
    if (type === 'RFA') return 'bg-purple-600';
    return 'bg-gray-600';
  };

  return (
    <div className="w-[119px] rounded-md p-2 shadow-sm">
      <div className="text-[11px] font-semibold mb-1">Contract</div>
      <div className="space-y-1">
        {displaySeasons.map((season, i) => (
          <div key={i} className="flex justify-between text-[11px]">
            <span className="text-white/50 w-[40px] tracking-tight">
              &apos;{season.year.toString().slice(-2)}-
              {(season.year + 1).toString().slice(-2)}
            </span>
            <span className="flex items-center gap-1">
              {season.freeAgentTag ? (
                <span
                  className={`px-1 py-[0.5px] rounded text-[9px] leading-3 ${getTagColor(season.freeAgentTag)}`}
                >
                  {season.freeAgentTag}
                </span>
              ) : season.amount !== null ? (
                <span
                  className={`${getAmountColor(season.optionType)} ${season.isExtensionYear ? 'underline underline-offset-2 decoration-blue-400/30' : ''}`}
                >
                  ${(season.amount / 1_000_000).toFixed(1)}M
                </span>
              ) : (
                <span className="text-white/30">—</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-white/10 text-[11px] flex justify-between">
        <span className="text-white/50">Rights:</span>
        <span className="font-normal text-[11px] capitalize">
          {bird_rights.toLowerCase()}
        </span>
      </div>
    </div>
  );
};

export default PlayerContractMini;
