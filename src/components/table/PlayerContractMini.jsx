import React from 'react';

const PlayerContractMini = ({
  contract = {},
  bird_rights = 'Unknown',
  option_type = {},
  free_agent_year,
  free_agent_type,
}) => {
  const today = new Date();
  const CURRENT_YEAR = today.getFullYear() - (today.getMonth() < 6 ? 1 : 0);

  // Combine base and extension salaries (extension takes precedence)
  const baseSalaries = contract?.annual_salaries || [];
  const extensionSalaries = contract?.extension?.annual_salaries || [];

  const allSalaries = [...baseSalaries, ...extensionSalaries].reduce(
    (acc, salary) => {
      if (salary.year >= CURRENT_YEAR) {
        acc[salary.year] = salary;
      }
      return acc;
    },
    {}
  );

  // Generate exactly 5 seasons (current year + 4 future years)
  const displaySeasons = Array.from({ length: 5 }, (_, i) => {
    const year = CURRENT_YEAR + i;
    const salaryData = allSalaries[year];
    const isExtensionYear = extensionSalaries.some((s) => s.year === year);

    // Determine option type (extension options take precedence)
    let optionType = null;
    if (salaryData?.option) {
      optionType = salaryData.option;
    } else if (option_type?.year === year && !isExtensionYear) {
      optionType = option_type.type;
    }

    // Determine free agency status (extension overrides base)
    let freeAgentTag = null;
    if (isExtensionYear && i === 4) {
      // Only show FA tag on last displayed year
      freeAgentTag = contract.extension?.free_agent_type || free_agent_type;
    } else if (year === free_agent_year) {
      freeAgentTag = free_agent_type;
    }

    return {
      year,
      amount: salaryData?.salary || null,
      optionType,
      freeAgentTag,
      isExtensionYear,
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
              '{season.year.toString().slice(-2)}-
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
