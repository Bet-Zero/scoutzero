// src/features/architect/tradeMachine/TradeLegalChecker.jsx
import React from 'react';

const TradeLegalChecker = ({ teamResults, capSettings }) => {
  const getRuleStatus = (passed) => {
    if (passed === undefined) return 'text-gray-500';
    return passed ? 'text-green-400' : 'text-red-400';
  };

  const RuleDisplay = ({ rule, label }) => {
    if (!rule) return null;
    return (
      <div>
        <div className={`${getRuleStatus(rule.passed)}`}>• {label}</div>
        {rule.details && (
          <span className="block text-xs text-white/50 pl-4">
            {rule.details}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-4">
      <h3 className="font-medium mb-3">CBA Rule Compliance</h3>

      {teamResults?.map((team, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <h4 className="font-medium text-sm mb-2">{team.teamName}</h4>

          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            <RuleDisplay
              rule={team.rules?.salaryMatching}
              label="Salary Matching"
            />
            <RuleDisplay rule={team.rules?.hardCap} label="Hard Cap" />
            <RuleDisplay
              rule={team.rules?.signAndTrade}
              label="Sign-and-Trade"
            />
            <RuleDisplay rule={team.rules?.stepienRule} label="Stepien Rule" />
            <RuleDisplay
              rule={team.rules?.secondApron}
              label="2nd Apron Rules"
            />
            <RuleDisplay rule={team.rules?.rosterCount} label="Roster Count" />
          </div>
        </div>
      ))}

      <div className="mt-3 text-xs text-white/60">
        <p>Green = Compliant, Red = Violation</p>
      </div>
    </div>
  );
};

export default TradeLegalChecker;
