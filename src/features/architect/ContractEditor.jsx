import React, { useState } from 'react';
import {
  generateContract,
  createMaxContract,
  generateRookieContract,
  getMinimumSalary,
} from '@/utils/architect/contractUtils';

const ContractEditor = ({ player, capSettings, teamCapSheet, onSign }) => {
  const [type, setType] = useState('Custom');
  const [years, setYears] = useState(4);
  const [baseSalary, setBaseSalary] = useState(10000000);
  const [raisePct, setRaisePct] = useState(0.08);
  const [options, setOptions] = useState({
    playerOption: false,
    teamOption: false,
  });
  const [guaranteedPercent, setGuaranteedPercent] = useState(100);
  const [preview, setPreview] = useState(null);

  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === 'Max') {
      const contract = createMaxContract(
        player.name,
        player.yearsOfService,
        capSettings
      );
      setPreview(contract);
    } else if (newType === 'Rookie') {
      const contract = generateRookieContract(player.draftPick || 10);
      setPreview(contract);
    } else if (newType === 'Minimum') {
      const min = getMinimumSalary(player.yearsOfService);
      const contract = generateContract({
        baseSalary: min,
        years: 1,
        raisePct: 0,
        options: {},
      });
      setPreview(contract);
    } else {
      setPreview(null);
    }
  };

  const handleCustomPreview = () => {
    const contract = generateContract({
      baseSalary,
      years,
      raisePct,
      options,
      startYear: new Date().getFullYear(),
    });
    setPreview(contract);
  };

  const handleSign = () => {
    if (!preview) return;

    const finalContract = {
      ...preview,
      type:
        type === 'Max'
          ? 'Max'
          : type === 'Rookie'
            ? 'Rookie Scale'
            : type === 'Minimum'
              ? 'Vet Minimum'
              : 'Custom',
      guaranteed:
        guaranteedPercent === 0
          ? false
          : guaranteedPercent === 100
            ? true
            : guaranteedPercent / 100,
      yearsOfService: player.yearsOfService || 0,
      isMinimum: type === 'Minimum',
    };

    onSign(player.name, finalContract);
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-3">
        Create Contract for {player.name}
      </h2>

      <label className="block mb-1">Contract Type:</label>
      <select
        value={type}
        onChange={(e) => handleTypeChange(e.target.value)}
        className="mb-3 p-2 bg-[#1a1a1a] border border-white/20 rounded"
      >
        <option value="Custom">Custom</option>
        <option value="Max">Max</option>
        <option value="Rookie">Rookie Scale</option>
        <option value="Minimum">Veteran Minimum</option>
      </select>

      {type === 'Custom' && (
        <div className="space-y-2 mb-4">
          <label className="block">Years:</label>
          <input
            type="number"
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            min={1}
            max={5}
            className="p-1 bg-[#1a1a1a] border border-white/20 rounded w-20"
          />

          <label className="block">Base Salary:</label>
          <input
            type="number"
            value={baseSalary}
            onChange={(e) => setBaseSalary(Number(e.target.value))}
            className="p-1 bg-[#1a1a1a] border border-white/20 rounded w-32"
          />

          <label className="block">Annual Raise %:</label>
          <input
            type="number"
            value={raisePct}
            step={0.01}
            onChange={(e) => setRaisePct(Number(e.target.value))}
            className="p-1 bg-[#1a1a1a] border border-white/20 rounded w-24"
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.playerOption}
              onChange={(e) =>
                setOptions({
                  ...options,
                  playerOption: e.target.checked,
                  playerOptionYear: e.target.checked
                    ? new Date().getFullYear() + years - 1
                    : null,
                })
              }
            />
            Player Option
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.teamOption}
              onChange={(e) =>
                setOptions({
                  ...options,
                  teamOption: e.target.checked,
                  teamOptionYear: e.target.checked
                    ? new Date().getFullYear() + years - 1
                    : null,
                })
              }
            />
            Team Option
          </label>

          <label className="block">
            Guarantee %
            <input
              type="number"
              value={guaranteedPercent}
              onChange={(e) => setGuaranteedPercent(parseFloat(e.target.value))}
              min={0}
              max={100}
              step={5}
              className="p-1 bg-[#1a1a1a] border border-white/20 rounded w-20 ml-2"
            />
          </label>

          <button
            onClick={handleCustomPreview}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            Preview Contract
          </button>
        </div>
      )}

      {preview && (
        <div className="bg-[#1a1a1a] p-4 rounded border border-white/10 mt-4">
          <h3 className="font-semibold mb-2">Contract Preview:</h3>
          <ul>
            {Object.entries(preview.yearly).map(([year, salary]) => (
              <li key={year}>
                {year}: ${salary.toLocaleString()}
              </li>
            ))}
          </ul>

          {(preview.playerOptions?.length || preview.teamOptions?.length) && (
            <p>
              Options: {preview.playerOptions?.length > 0 && 'Player Option '}
              {preview.teamOptions?.length > 0 && 'Team Option '}
            </p>
          )}

          <p>
            Guarantee:{' '}
            {guaranteedPercent === 0
              ? 'Non-guaranteed'
              : guaranteedPercent === 100
                ? 'Fully guaranteed'
                : `${guaranteedPercent}% guaranteed`}
          </p>

          <button
            onClick={handleSign}
            className="mt-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
          >
            Sign Player
          </button>
        </div>
      )}
    </div>
  );
};

export default ContractEditor;
