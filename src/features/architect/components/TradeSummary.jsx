import React from 'react';

const TradeSummary = ({ result, teams = [], forceTrade = false }) => {
  if (!result) return null;

  return (
    <div className="mt-4 text-sm">
      <strong>
        {forceTrade
          ? '⚠️ Trade Forced – Not CBA Legal'
          : result.legal
            ? '✅ Trade Approved'
            : '❌ Trade Rejected'}
      </strong>
      <p>{result.reason || 'Trade complies with all rules.'}</p>
      {result.summary && (
        <div className="mt-2 space-y-1">
          <p>
            <strong>{teams[0].team.teamName} send:</strong>{' '}
            {result.summary.teamAOut.join(', ') || 'None'}
          </p>
          <p>
            <strong>{teams[1].team.teamName} send:</strong>{' '}
            {result.summary.teamBOut.join(', ') || 'None'}
          </p>
          <p>
            {teams[0].team.teamName} - Salary Out: $
            {result.summary.teamASalaryOut.toLocaleString()} | Salary In: $
            {result.summary.teamASalaryIn.toLocaleString()}
          </p>
          <p>
            {teams[1].team.teamName} - Salary Out: $
            {result.summary.teamBSalaryOut.toLocaleString()} | Salary In: $
            {result.summary.teamBSalaryIn.toLocaleString()}
          </p>
        </div>
      )}
      {result.summaryByTeamIndex && (
        <div className="mt-4 space-y-2">
          {result.summaryByTeamIndex.filter(Boolean).map((s) => (
            <div key={s.teamName}>
              <strong>{s.teamName} Summary:</strong>
              <ul className="ml-4 list-disc text-sm">
                <li>Gained: {s.playersIn.join(', ') || 'None'}</li>
                <li>Lost: {s.playersOut.join(', ') || 'None'}</li>
                <li>Picks In: {s.picksIn.join(', ') || 'None'}</li>
                <li>Picks Out: {s.picksOut.join(', ') || 'None'}</li>
                <li>
                  Roster Change: {s.rosterDelta >= 0 ? '+' : ''}
                  {s.rosterDelta}
                </li>
                <li>Cap Change: ${s.capDelta.toLocaleString()}</li>
              </ul>
            </div>
          ))}
        </div>
      )}
      {result.teamResults && (
        <div className="mt-4 space-y-1">
          {result.teamResults.map((tr, i) => (
            <div key={i}>
              <strong>{tr.teamName || `Team ${i + 1}`}:</strong>{' '}
              {tr.legal ? 'Legal' : `Illegal – ${tr.reason}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradeSummary;
