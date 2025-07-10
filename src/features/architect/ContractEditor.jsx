import React, { useState } from 'react';
import { 
  generateContract, 
  createMaxContract, 
  generateRookieContract, 
  getMinimumSalary 
} from '../utils/contractUtils';

const ContractEditor = ({ player, capSettings, teamCapSheet, onSign }) => {
  const [type, setType] = useState('Custom');
  const [years, setYears] = useState(4);
  const [baseSalary, setBaseSalary] = useState(10000000);
  const [raisePct, setRaisePct] = useState(0.08);
  const [options, setOptions] = useState({ 
    playerOption: false, 
    teamOption: false 
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
        options: {} 
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
      startYear: new Date().getFullYear()
    });
    setPreview(contract);
  };

  const handleSign = () => {
    if (!preview) return;
    
    const finalContract = {
      ...preview,
      type: type === 'Max' ? 'Max' : 
            type === 'Rookie' ? 'Rookie Scale' : 
            type === 'Minimum' ? 'Vet Minimum' : 'Custom',
      guaranteed: guaranteedPercent === 0 ? false : 
                 guaranteedPercent === 100 ? true : 
                 guaranteedPercent / 100,
      yearsOfService: player.yearsOfService || 0,
      isMinimum: type === 'Minimum'
    };
    
    onSign(player.name, finalContract);
  };

  return (
    <div className="contract-editor">
      <h2>Create Contract for {player.name}</h2>
      
      <label>Contract Type:</label>
      <select 
        value={type} 
        onChange={(e) => handleTypeChange(e.target.value)}
      >
        <option value="Custom">Custom</option>
        <option value="Max">Max</option>
        <option value="Rookie">Rookie Scale</option>
        <option value="Minimum">Veteran Minimum</option>
      </select>

      {type === 'Custom' && (
        <div className="custom-contract-fields">
          <label>Years:</label>
          <input 
            type="number" 
            value={years} 
            onChange={(e) => setYears(Number(e.target.value))} 
            min={1} 
            max={5} 
          />

          <label>Base Salary:</label>
          <input 
            type="number" 
            value={baseSalary} 
            onChange={(e) => setBaseSalary(Number(e.target.value))} 
          />

          <label>Annual Raise %:</label>
          <input 
            type="number" 
            value={raisePct} 
            step={0.01} 
            onChange={(e) => setRaisePct(Number(e.target.value))} 
          />

          <label>
            <input 
              type="checkbox" 
              checked={options.playerOption} 
              onChange={(e) => setOptions({ 
                ...options, 
                playerOption: e.target.checked,
                playerOptionYear: e.target.checked ? 
                  new Date().getFullYear() + years - 1 : null
              })} 
            />
            Player Option
          </label>

          <label>
            <input 
              type="checkbox" 
              checked={options.teamOption} 
              onChange={(e) => setOptions({ 
                ...options, 
                teamOption: e.target.checked,
                teamOptionYear: e.target.checked ? 
                  new Date().getFullYear() + years - 1 : null
              })} 
            />
            Team Option
          </label>

          <label>
            Guarantee %
            <input 
              type="number" 
              value={guaranteedPercent} 
              onChange={(e) => setGuaranteedPercent(parseFloat(e.target.value))} 
              min={0} 
              max={100} 
              step={5} 
            />
          </label>

          <button onClick={handleCustomPreview}>Preview Contract</button>
        </div>
      )}

      {preview && (
        <div className="contract-preview">
          <h3>Contract Preview:</h3>
          <ul>
            {Object.entries(preview.salaryByYear).map(([year, salary]) => (
              <li key={year}>
                {year}: ${salary.toLocaleString()}
              </li>
            ))}
          </ul>
          
          {(preview.options?.playerOption || preview.options?.teamOption) && (
            <p>
              Options:{' '}
              {preview.options?.playerOption && 'Player Option '}
              {preview.options?.teamOption && 'Team Option '}
            </p>
          )}
          
          <p>
            Guarantee: {guaranteedPercent === 0 ? 'Non-guaranteed' : 
                      guaranteedPercent === 100 ? 'Fully guaranteed' : 
                      `${guaranteedPercent}% guaranteed`}
          </p>

          <button onClick={handleSign}>Sign Player</button>
        </div>
      )}
    </div>
  );
};

export default ContractEditor;