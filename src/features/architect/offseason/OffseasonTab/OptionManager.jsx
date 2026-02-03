/**
 * FILE: src/features/architect/offseason/OffseasonTab/OptionManager.jsx
 * PURPOSE: Collect option decisions for offseason transitions (playerId-keyed).
 * OWNERSHIP: Feature: architect/offseason
 *
 * HISTORY:
 *  - 2026-02-03: Updated for OSTE option decision normalization (plan `plans/_archive/offseason-transition-engine-phase1/plan.md`, chunk_n/a)
 *
 * LINKS:
 *  - Plan: plans/_archive/offseason-transition-engine-phase1/plan.md
 *  - Latest Chunk: N/A
 */

import React, { useState, useEffect } from 'react';
import { formatName } from '@/shared/utils/formatting';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';

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

const getPlayerId = (player) =>
  player?.player_id || player?.id || player?.playerId || null;

const OptionManager = ({ teamCapSheet, currentYear, onDecisionsReady }) => {
  const [optionsList, setOptionsList] = useState([]);
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    const nextYear = currentYear + 1;
    const seasonKey = toSeasonCode(nextYear);
    const players = Array.isArray(teamCapSheet?.players)
      ? teamCapSheet.players
      : [];

    const options = players
      .map((p) => {
        const entry = getContractYearSlice(p, nextYear);
        const salary = entry?.salary ?? entry?.capHit;
        const optionType = entry?.option || null;
        if (salary == null || !optionType) return null;

        const playerId = getPlayerId(p);
        const decisionKey = playerId || p?.name;
        if (!decisionKey) return null;

        return {
          decisionKey,
          playerId,
          name: p.displayName || p.name || 'Unknown',
          salary,
          type: optionType,
          season: seasonKey,
        };
      })
      .filter(Boolean);

    setOptionsList(options);

    const initialDecisions = {};
    options.forEach((opt) => {
      initialDecisions[opt.decisionKey] = {
        decision: 'exercise',
        optionType: opt.type,
        season: opt.season,
      };
    });
    setDecisions(initialDecisions);
  }, [teamCapSheet, currentYear]);

  const toggleDecision = (decisionKey) => {
    setDecisions((prev) => {
      const current = prev[decisionKey];
      const nextDecision =
        current?.decision === 'exercise' ? 'decline' : 'exercise';
      return {
        ...prev,
        [decisionKey]: {
          ...current,
          decision: nextDecision,
        },
      };
    });
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
            {optionsList.map((opt, index) => (
              <tr key={`${opt.decisionKey}-${index}`} className="odd:bg-[#171717]">
                <td className="p-2">{formatName(opt.name)}</td>
                <td className="p-2">{opt.type}</td>
                <td className="p-2">${opt.salary.toLocaleString()}</td>
                <td className="p-2">
                  <button
                    onClick={() => toggleDecision(opt.decisionKey)}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {decisions[opt.decisionKey]?.decision === 'exercise'
                      ? 'Accept'
                      : 'Decline'}
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
