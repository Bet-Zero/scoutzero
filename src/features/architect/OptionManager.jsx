import React, { useState, useEffect } from 'react';

const OptionManager = ({ teamCapSheet, currentYear, onDecisionsReady }) => {
  const [optionsList, setOptionsList] = useState([]);
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    const nextYear = currentYear + 1;
    const options = teamCapSheet.activeContracts
      .map((contract) => {
        const salary = contract.salaryByYear?.[nextYear];
        const optionType = contract.options?.playerOption ? 'Player Option' : 
                         contract.options?.teamOption ? 'Team Option' : null;
        const optionYear = contract.options?.playerOptionYear || 
                         contract.options?.teamOptionYear;

        if (!salary || !optionType || optionYear !== nextYear) return null;

        return {
          name: contract.name,
          salary,
          type: optionType
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
    <div className="option-manager">
      <h3>Pending Contract Options – {currentYear + 1}</h3>
      
      {optionsList.length === 0 ? (
        <p>No player or team options pending.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Type</th>
              <th>Salary</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {optionsList.map((opt) => (
              <tr key={opt.name}>
                <td>{opt.name}</td>
                <td>{opt.type}</td>
                <td>${opt.salary.toLocaleString()}</td>
                <td>
                  <button onClick={() => toggleDecision(opt.name)}>
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
          style={{ marginTop: '10px' }}
        >
          Confirm Decisions
        </button>
      )}
    </div>
  );
};

export default OptionManager;