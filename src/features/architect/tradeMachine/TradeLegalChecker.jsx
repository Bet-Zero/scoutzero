// src/features/architect/tradeMachine/TradeLegalChecker.jsx
import React from 'react';

const TradeLegalChecker = ({ teamResults, capSettings }) => {
  const getRuleStatus = (passed) => {
    if (passed === undefined) return 'text-gray-500';
    return passed ? 'text-green-400' : 'text-red-400';
  };

  const RuleDisplay = ({ rule, label }) => {
    if (!rule) return null;
    
    // Ensure rule is a proper rule object, not an array or other type
    if (typeof rule !== 'object' || Array.isArray(rule) || rule.passed === undefined) {
      return null;
    }
    
    return (
      <div>
        <div className={`${getRuleStatus(rule.passed)}`}>• {label}</div>
        {rule.details && (
          <span className="block text-xs text-white/50 pl-4">
            {typeof rule.details === 'string' ? rule.details : rule.message || ''}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-4">
      <h3 className="font-medium mb-3">CBA Rule Compliance Overview</h3>

      {teamResults?.map((team, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <h4 className="font-medium text-sm mb-2">{team.teamName}</h4>

          <div className="grid grid-cols-3 gap-y-2 gap-x-4 text-xs">
            {/* Core Rules */}
            <RuleDisplay
              rule={team.rules?.salaryMatching}
              label="Salary Matching"
            />
            <RuleDisplay rule={team.rules?.hardCap} label="Hard Cap" />
            <RuleDisplay rule={team.rules?.stepienRule} label="Stepien Rule" />
            
            {/* CBA Compliance */}
            <RuleDisplay
              rule={team.rules?.signAndTrade}
              label="Sign-and-Trade"
            />
            <RuleDisplay
              rule={team.rules?.secondApronEnforcement}
              label="2nd Apron Rules"
            />
            <RuleDisplay rule={team.rules?.rosterCount} label="Roster Count" />
            
            {/* Advanced Rules */}
            <RuleDisplay
              rule={team.rules?.consent}
              label="Player Consent"
            />
            <RuleDisplay
              rule={team.rules?.reacquisition}
              label="Reacquisition"
            />
            <RuleDisplay
              rule={team.rules?.aggregation}
              label="Salary Aggregation"
            />
            
            {/* Trade Mechanics */}
            <RuleDisplay
              rule={team.rules?.tradeExceptions}
              label="Trade Exceptions"
            />
            <RuleDisplay rule={team.rules?.cash} label="Cash Inclusion" />
            <RuleDisplay
              rule={team.rules?.timingEnforcement}
              label="Timing Restrictions"
            />
          </div>
        </div>
      ))}

      <div className="mt-3 text-xs text-white/60">
        <p>🟢 Compliant • 🔴 Violation • ⚪ Not Applicable</p>
      </div>
    </div>
  );
};

export default TradeLegalChecker;
