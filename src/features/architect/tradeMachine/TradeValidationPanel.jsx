// src/features/architect/tradeMachine/TradeValidationPanel.jsx
import React from 'react';
import { HelpCircle } from 'lucide-react';

const RULE_INFO = [
  {
    pattern: /salary/i,
    tip: 'Teams must match incoming and outgoing salary based on cap status.',
    link: 'https://nba.com/cba/salary-matching',
  },
  {
    pattern: /sign-and-trade/i,
    tip: 'Sign-and-trade players must be traded alone and cannot push a team above the first apron.',
    link: 'https://nba.com/cba/sign-and-trade',
  },
  {
    pattern: /second apron/i,
    tip: 'Second apron teams cannot aggregate salaries, take back more money, or include cash.',
    link: 'https://nba.com/cba/second-apron',
  },
  {
    pattern: /stepien/i,
    tip: 'Teams may not trade consecutive future first-round picks unless protected.',
    link: 'https://nba.com/cba/stepien-rule',
  },
];

const getRuleInfo = (msg) => {
  return (
    RULE_INFO.find((r) => r.pattern.test(msg)) || {
      tip: 'See full CBA documentation',
      link: 'https://nba.com/cba',
    }
  );
};

const TradeValidationPanel = ({ result }) => {
  if (!result) return null;
  const { teamResults = [] } = result;

  return (
    <div className="mt-6 p-4 bg-[#111] border border-white/10 rounded space-y-4">
      <h3 className="font-semibold text-base">Validation Results</h3>
      {teamResults.map((team, idx) => (
        <div key={idx}>
          <h4 className="font-medium text-sm mb-1">{team.teamName}</h4>
          <ul className="list-disc ml-5 space-y-1">
            {Object.values(team.rules || {}).map((r, i) => (
              <li
                key={i}
                className={r.passed ? 'text-green-400' : 'text-red-400'}
              >
                {r.message} {!r.passed && r.details && `– ${r.details}`}
              </li>
            ))}

            {team.apronStatus?.includes('⚠️') && (
              <li className="text-yellow-400 flex items-start">
                <span>{team.apronStatus}</span>
                <HelpCircle
                  size={14}
                  className="ml-1"
                  title="Team is near an apron threshold which may limit future moves"
                />
              </li>
            )}
          </ul>
        </div>
      ))}
      <div className="text-xs text-white/60">
        <p className="text-red-400">Red items are rule violations.</p>
        <p className="text-yellow-400">Yellow items are warnings.</p>
        <p className="text-green-400">Green items are compliant.</p>
      </div>
      <div className="border-t border-white/10 pt-3">
        <h4 className="font-semibold text-sm mb-1">CBA References</h4>
        <ul className="list-disc ml-5 text-blue-300 space-y-1 text-xs">
          {RULE_INFO.map((r) => (
            <li key={r.link}>
              <a href={r.link} target="_blank" rel="noopener noreferrer">
                {r.link.split('/cba/')[1].replace(/-/g, ' ')}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default TradeValidationPanel;
