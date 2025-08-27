// src/features/architect/tradeMachine/TradeValidationPanel.jsx
import React, { useState } from 'react';
import { HelpCircle, BookOpen } from 'lucide-react';

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
    pattern: /FA Exception unavailable/i,
    tip: 'FA Exceptions only available to teams below the first apron and not in the second apron.',
    link: 'https://nba.com/cba/fa-exceptions',
  },
  {
    pattern: /Cannot combine FA Exception/i,
    tip: 'FA Exceptions cannot be combined with outgoing salary or other buckets for the same player.',
    link: 'https://nba.com/cba/fa-exceptions',
  },
  {
    pattern: /Insufficient FA Exception balance/i,
    tip: 'Selected FA Exception bucket lacks enough value to absorb the player.',
    link: 'https://nba.com/cba/fa-exceptions',
  },
  {
    pattern: /hard-caps team at First Apron/i,
    tip: 'Using a FA Exception imposes a First Apron hard cap for the season.',
    link: 'https://nba.com/cba/aprons',
  },
  {
    pattern: /stepien/i,
    tip: 'Teams may not trade consecutive future first-round picks unless protected.',
    link: 'https://nba.com/cba/stepien-rule',
  },
  {
    pattern: /Player NTC — consent required/i,
    tip: 'Players with no-trade clauses must approve any deal.',
    link: 'https://nba.com/cba/no-trade-clause',
  },
  {
    pattern: /1-yr Bird veto — consent required/i,
    tip: 'One-year Bird-rights players can veto trades that would strip their rights.',
    link: 'https://nba.com/cba/bird-rights',
  },
  {
    pattern: /Re-acquisition bar/i,
    tip: 'Teams cannot reacquire a player they recently traded or waived until the restriction expires.',
    link: 'https://nba.com/cba/reacquisition',
  },
  {
    pattern: /Two-way slots exceeded/i,
    tip: 'Teams may roster at most 3 players on two-way contracts.',
    link: 'https://nba.com/cba/two-way',
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
  const [expanded, setExpanded] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState({});
  if (!result) return null;
  const { teamResults = [] } = result;

  const handleToggleDetails = (teamIdx, ruleIdx) => {
    setDetailsOpen((prev) => ({
      ...prev,
      [`${teamIdx}-${ruleIdx}`]: !prev[`${teamIdx}-${ruleIdx}`],
    }));
  };

  // Helper to identify second apron violations
  const getSecondApronViolations = (team) => {
    if (!team.rules) return [];
    return Object.values(team.rules).filter(rule => 
      rule.message && (
        rule.message.includes('second apron') || 
        rule.message.includes('Second Apron') ||
        rule.message.includes('aggregate') ||
        rule.message.includes('take back more')
      )
    );
  };

  return (
    <div className="mt-6 p-4 bg-[#111] border border-white/10 rounded text-xs">
      <button
        className="mb-2 px-3 py-1 bg-[#222] text-white rounded border border-white/20 hover:bg-[#333]"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Hide Validation Results' : 'Show Validation Results'}
      </button>
      {expanded && (
        <div>
          <h3 className="font-semibold text-base mb-3">Validation Results</h3>
          <div className="flex gap-8 overflow-x-auto">
            {teamResults.map((team, teamIdx) => (
              <React.Fragment key={teamIdx}>
                <div className="min-w-[280px] flex-1 bg-[#181818] rounded-lg p-4 border border-white/10 shadow">
                  <div className="flex items-center mb-2 gap-2">
                    {team.logoUrl && (
                      <img
                        src={team.logoUrl}
                        alt="logo"
                        className="w-8 h-8 rounded-full border border-white/20 bg-[#222] object-contain"
                      />
                    )}
                    <h4 className="font-bold text-sm">{team.teamName}</h4>
                    {/* Second Apron Warning Badge */}
                    {getSecondApronViolations(team).length > 0 && (
                      <span className="px-2 py-1 bg-red-900/30 text-red-400 text-xs font-medium border border-red-500/50 rounded">
                        2ND APRON
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {(team.rules ? Object.values(team.rules) : []).map(
                      (r, ruleIdx) => {
                        const ruleInfo = getRuleInfo(r.message);
                        let displayMsg = r.message;
                        if (r.passed) {
                          displayMsg = displayMsg
                            .replace(/(valid|satisfied|compliant)/gi, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                        }
                        const detailsKey = `${teamIdx}-${ruleIdx}`;
                        return (
                          <div
                            key={ruleIdx}
                            className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${
                              r.passed
                                ? 'bg-green-900/10 text-green-400'
                                : r.details
                                  ? 'bg-red-900/10 text-red-400'
                                  : 'bg-yellow-900/10 text-yellow-400'
                            }`}
                          >
                            <span>{displayMsg}</span>
                            <div className="flex items-center gap-2">
                              {!r.passed && r.details && (
                                <>
                                  <button
                                    className="px-2 py-0.5 bg-red-900/60 text-white rounded text-xs border border-red-400 hover:bg-red-800"
                                    onClick={() =>
                                      handleToggleDetails(teamIdx, ruleIdx)
                                    }
                                    type="button"
                                  >
                                    Details
                                  </button>
                                  {detailsOpen[detailsKey] && (
                                    <div className="mt-1 p-2 bg-[#222] border border-red-400 rounded text-white text-xs max-w-xs">
                                      {typeof r.details === 'string' ? r.details : r.message || JSON.stringify(r.details)}
                                    </div>
                                  )}
                                </>
                              )}
                              {ruleInfo && ruleInfo.link && (
                                <a
                                  href={ruleInfo.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="align-middle"
                                  title="View CBA Reference"
                                >
                                  {/* New icon: external link */}
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M14 3H17V6"
                                      stroke="#60A5FA"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M9 11L17 3"
                                      stroke="#60A5FA"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <rect
                                      x="3"
                                      y="7"
                                      width="10"
                                      height="10"
                                      rx="2"
                                      stroke="#60A5FA"
                                      strokeWidth="2"
                                    />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                    {team.apronStatus?.includes('⚠️') && (
                      <div className="flex items-center gap-2 bg-yellow-900/30 text-yellow-400 rounded px-2 py-1 mt-2">
                        <span>{team.apronStatus}</span>
                        <HelpCircle
                          size={14}
                          className="ml-1"
                          title="Team is near an apron threshold which may limit future moves"
                        />
                      </div>
                    )}
                    
                    {/* Enhanced Second Apron Information */}
                    {getSecondApronViolations(team).length > 0 && (
                      <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded">
                        <div className="text-red-400 font-medium text-xs mb-2 flex items-center gap-1">
                          🚫 Second Apron Restrictions
                        </div>
                        <div className="space-y-1">
                          {getSecondApronViolations(team).map((violation, vIndex) => (
                            <div key={vIndex} className="text-xs text-red-300">
                              • {violation.message}
                            </div>
                          ))}
                          <div className="text-xs text-white/50 mt-2 border-t border-red-500/20 pt-2">
                            Second apron teams cannot: aggregate salaries in trades, take back more money than sent, 
                            include cash, use trade exceptions from prior years, or sign players using exceptions.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {teamIdx < teamResults.length - 1 && (
                  <div className="flex items-center mx-2">
                    <div className="w-px h-32 bg-white/20" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex gap-4 mt-6">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />
              <span className="text-green-400 text-xs">Compliant</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
              <span className="text-yellow-400 text-xs">Warning</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
              <span className="text-red-400 text-xs">Violation</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeValidationPanel;
