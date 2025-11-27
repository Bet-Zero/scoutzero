import React, { useState, useEffect } from 'react';
import { formatName } from '@/shared/utils/formatting';

// Get contract year data from Architect contract shape (BasePlayerContractZ)
const getContractYearSlice = (player, endYear) => {
  if (!player) return null;

  const contract = player.contract;
  if (contract?.salariesByYear?.length) {
    const seasonKey = `${endYear - 1}-${String(endYear).slice(-2)}`;
    const yearEntry =
      contract.salariesByYear.find((y) => y.season === seasonKey) ||
      contract.salariesByYear.find((y) => String(y.season) === String(endYear));
    if (yearEntry) return yearEntry;
  }

  return null;
};

const OptionManager = ({
  teamCapSheet,
  currentYear,
  onDecisionsReady,
  playersMap = {},
}) => {
  const [optionsList, setOptionsList] = useState([]);
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    const nextYear = currentYear + 1;
    const options = teamCapSheet.players
      .map((p) => {
        const entry = getContractYearSlice(p, nextYear);
        const salary = entry?.salary || entry?.capHit;
        const optionType = entry?.option || null;
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
    options.forEach((opt) => {
      initialDecisions[opt.name] = true; // default to accept
    });
    setDecisions(initialDecisions);
  }, [teamCapSheet, currentYear]);

  const toggleDecision = (name) => {
    setDecisions((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleSubmit = () => {
    onDecisionsReady(decisions);
  };

  return (
    <div className="text-white">
      <h3 className="text-lg font-semibold mb-2">
        Pending Contract Options – {currentYear + 1}
      </h3>

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
                <td className="p-2">
                  {playersMap[opt.name]?.bio?.displayName || formatName(opt.name)}
                </td>
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
