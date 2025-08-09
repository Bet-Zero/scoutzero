import React, { useState } from 'react';
import { tradeDebug } from '@/utils/architect/tradeMachine/tradeValidator.js';

const TradeDebugPanel = () => {
  const [showSalary, setShowSalary] = useState(true);
  const [rule, setRule] = useState('all');
  const [expanded, setExpanded] = useState(false);

  const teams = Array.from(
    new Set(tradeDebug.records.map((r) => r.team).filter(Boolean))
  );
  const rules = Array.from(
    new Set(tradeDebug.records.map((r) => r.rule).filter(Boolean))
  );

  // Group logs by team
  const logsByTeam = teams.reduce((acc, t) => {
    acc[t] = tradeDebug.flushToUI({
      showSalary,
      team: t,
      rule: rule === 'all' ? null : rule,
    });
    return acc;
  }, {});

  return (
    <div className="mt-6 p-4 bg-[#111] border border-white/10 rounded text-xs">
      <button
        className="mb-2 px-3 py-1 bg-[#222] text-white rounded border border-white/20 hover:bg-[#333]"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Hide Trade Debug Panel' : 'Show Trade Debug Panel'}
      </button>
      {expanded && (
        <div>
          <div className="flex gap-2 flex-wrap items-center mb-2">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showSalary}
                onChange={(e) => setShowSalary(e.target.checked)}
              />
              Show Salary
            </label>
            <select
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              className="bg-[#222] text-white text-xs px-2 py-1 rounded"
            >
              <option value="all">All Rules</option>
              {rules.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 overflow-x-auto">
            {teams.map((t) => (
              <div key={t} className="min-w-[250px] flex-1">
                <div className="font-bold mb-1 text-white">{t}</div>
                <pre className="whitespace-pre-wrap max-h-80 overflow-auto bg-[#222] p-2 rounded">
                  {logsByTeam[t].join('\n')}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeDebugPanel;
