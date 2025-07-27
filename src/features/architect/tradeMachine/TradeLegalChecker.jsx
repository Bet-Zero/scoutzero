import React from 'react';

const TradeLegalChecker = ({ teamResults, capSettings }) => {
  const getRuleStatus = (check) => {
    if (check === undefined) return 'text-gray-500';
    return check ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-4">
      <h3 className="font-medium mb-3">CBA Rule Compliance</h3>

      {teamResults?.map((team, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <h4 className="font-medium text-sm mb-2">{team.teamName}</h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`${getRuleStatus(team.checks?.salaryMatching)}`}>
              • Salary Matching
            </div>
            <div className={`${getRuleStatus(team.checks?.hardCap)}`}>
              • Hard Cap
            </div>
            <div className={`${getRuleStatus(team.checks?.signAndTrade)}`}>
              • Sign-and-Trade
            </div>
            <div className={`${getRuleStatus(team.checks?.stepien)}`}>
              • Stepien Rule
            </div>
            <div className={`${getRuleStatus(team.checks?.secondApron)}`}>
              • 2nd Apron Rules
            </div>
            <div className={`${getRuleStatus(team.checks?.rosterCount)}`}>
              • Roster Count (15 max)
            </div>
          </div>

          {team.apronStatus && (
            <div className="mt-2 text-xs">
              Status: <span className="font-medium">{team.apronStatus}</span>
            </div>
          )}
        </div>
      ))}

      <div className="mt-3 text-xs text-white/60">
        <p>Green = Compliant, Red = Violation</p>
      </div>
    </div>
  );
};

export default TradeLegalChecker;
