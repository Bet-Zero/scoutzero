import React, { useState, useEffect } from 'react';

const OptionManager = ({ teamCapSheet, currentYear, onDecisionsReady }) => {
  const [optionsList, setOptionsList] = useState([]);
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    const nextYear = currentYear + 1;
    const key = `${nextYear}-${String(nextYear + 1).slice(-2)}`;
    const options = teamCapSheet.players
      .map((p) => {
        const salary = p.contract_clean?.yearly?.[key];
        const hasPO = p.contract_clean?.playerOptions?.includes(key);
        const hasTO = p.contract_clean?.teamOptions?.includes(key);
        const optionType = hasPO ? 'Player Option' : hasTO ? 'Team Option' : null;
        if (!salary || !optionType) return null;

        return {
          name: p.name,
          salary,
          type: optionType,
        };
      })
      .filter(Boolean);

    setOptionsList(options);
    
    const initialDecisions = {};
    options.forEach(opt => {
      initialDecisions[opt.name] = true; // default to accept
    });
    setDecisions(initialDecisions);
  }, [teamCapSheet, currentYear]);

  const toggleDecision = (name) => {
    setDecisions(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleSubmit = () => {
    onDecisionsReady(decisions);
  };

  return (
    <div className="text-white">
      <h3 className="text-lg font-semibold mb-2">Pending Contract Options – {currentYear + 1}</h3>
      
      {optionsList.length === 0 ? (
        <p>No player or team options pending.</p>
      ) : (
        <table className="min-w-full text-sm bg-[#1a1a1a] border border-white/10 rounded">
          <thead className="bg-[#111]">
            <tr>
              <th className="p-2 text-left">Player</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Salary</th>
              <th className="p-2 text-left">Decision</th>
            </tr>
          </thead>
          <tbody>
            {optionsList.map((opt) => (
              <tr key={opt.name} className="odd:bg-[#171717]">
                <td className="p-2">{opt.name}</td>
                <td className="p-2">{opt.type}</td>
                <td className="p-2">${opt.salary.toLocaleString()}</td>
                <td className="p-2">
                  <button
                    onClick={() => toggleDecision(opt.name)}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {decisions[opt.name] ? 'Accept' : 'Decline'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {optionsList.length > 0 && (
        <button
          onClick={handleSubmit}
          className="mt-3 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
        >
          Confirm Decisions
        </button>
      )}
    </div>
  );
};

export default OptionManager;