import React, { useState } from 'react';
import { tradeDebug } from '@/utils/architect/tradeMachine/tradeValidator.js';

const TradeDebugPanel = () => {
  const [showSalary, setShowSalary] = useState(true);
  const [team, setTeam] = useState('all');
  const [rule, setRule] = useState('all');

  const teams = Array.from(
    new Set(tradeDebug.records.map((r) => r.team).filter(Boolean))
  );
  const rules = Array.from(
    new Set(tradeDebug.records.map((r) => r.rule).filter(Boolean))
  );

  const logs = tradeDebug.flushToUI({
    showSalary,
    team: team === 'all' ? null : team,
    rule: rule === 'all' ? null : rule,
  });

  return (
    <div className="mt-6 p-4 bg-[#111] border border-white/10 rounded space-y-2 text-xs">
      <div className="flex gap-2 flex-wrap items-center">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={showSalary}
            onChange={(e) => setShowSalary(e.target.checked)}
          />
          Show Salary
        </label>
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="bg-[#222] text-white text-xs px-2 py-1 rounded"
        >
          <option value="all">All Teams</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
      <pre className="whitespace-pre-wrap max-h-80 overflow-auto bg-[#222] p-2 rounded">
        {logs.join('\n')}
      </pre>
    </div>
  );
};

export default TradeDebugPanel;
