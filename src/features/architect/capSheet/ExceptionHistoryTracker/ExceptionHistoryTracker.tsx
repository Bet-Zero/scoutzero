import React from 'react';

type ExceptionHistoryEntry = {
  id?: string | number | null;
  amount?: number | null;
  amountRemaining?: number | null;
  amountCreated?: number | null;
  amountConsumed?: number | null;
  remainingAmountAfter?: number | null;
  createdFrom?: string | null;
  absorbedPlayers?: Array<{ name?: string | null }> | null;
  expiresOn?: string | null;
  expires?: string | null;
  expiresAt?: string | null;
  source?: string | null;
  sourcePlayerName?: string | null;
  date?: string | null;
  timestamp?: string | null;
  action?: string | null;
  type?: string | null;
};

type MLEHistoryEntry = {
  id?: string | number | null;
  year?: string | number | null;
  total?: number | null;
  used?: number | null;
  notes?: string | null;
};

type ExceptionHistoryRow = ExceptionHistoryEntry & {
  date: string;
  action: string;
  amount: number | null;
  source: string;
  expires: string;
};

type ExceptionHistoryTrackerProps = {
  exceptionHistory?: ExceptionHistoryEntry[];
  mleHistory?: MLEHistoryEntry[];
};

const formatAmount = (entry: ExceptionHistoryEntry) => {
  if (typeof entry.amount === 'number') return entry.amount;
  if (typeof entry.amountRemaining === 'number') return entry.amountRemaining;
  if (typeof entry.amountConsumed === 'number') return entry.amountConsumed;
  if (typeof entry.amountCreated === 'number') return entry.amountCreated;
  return null;
};

const mapExceptionRow = (
  entry: ExceptionHistoryEntry = {}
): ExceptionHistoryRow => {
  const expires = entry.expiresOn || entry.expires || entry.expiresAt || '—';
  const source =
    entry.createdFrom ||
    entry.absorbedPlayers
      ?.map((player) => player.name)
      .filter(Boolean)
      .join(', ') ||
    entry.source ||
    entry.sourcePlayerName ||
    '—';
  const date = entry.date || entry.timestamp || '—';
  const action = entry.action || entry.type || '—';
  const amount = formatAmount(entry);

  return {
    ...entry,
    date,
    action,
    amount,
    source,
    expires,
  };
};

export const ExceptionHistoryTracker = ({
  exceptionHistory = [],
  mleHistory = [],
}: ExceptionHistoryTrackerProps) => {
  const renderTPEHistory = () => {
    if (exceptionHistory.length === 0) return <p>No TPE activity logged.</p>;
    const rows = exceptionHistory.map((entry) => mapExceptionRow(entry));
    return (
      <table
        data-testid="team-history-tpe-table"
        className="min-w-full text-sm bg-cockpit-raised border border-cockpit-edge rounded-md"
      >
        <thead>
          <tr>
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-left">Action</th>
            <th className="p-2 text-left">Amount</th>
            <th className="p-2 text-left">Player</th>
            <th className="p-2 text-left">Expires</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, idx) => (
            <tr
              key={entry.id || idx}
              data-testid={`team-history-tpe-row-${idx}`}
              className="odd:bg-cockpit-slab"
            >
              <td className="p-2">{entry.date}</td>
              <td className="p-2">{entry.action}</td>
              <td className="p-2">
                {entry.amount == null
                  ? '—'
                  : `$${entry.amount.toLocaleString()}`}
                {typeof entry.remainingAmountAfter === 'number' && (
                  <div className="text-xs text-cockpit-text-muted">
                    ${entry.remainingAmountAfter.toLocaleString()} remaining
                  </div>
                )}
              </td>
              <td className="p-2">{entry.source || '—'}</td>
              <td className="p-2">{entry.expires || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderMLEHistory = () => {
    if (mleHistory.length === 0) return <p>No MLE activity logged.</p>;
    return (
      <table
        data-testid="team-history-mle-table"
        className="min-w-full text-sm bg-cockpit-raised border border-cockpit-edge rounded-md"
      >
        <thead>
          <tr>
            <th className="p-2 text-left">Year</th>
            <th className="p-2 text-left">Total</th>
            <th className="p-2 text-left">Used</th>
            <th className="p-2 text-left">Remaining</th>
            <th className="p-2 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {mleHistory.map((mle, idx) => (
            <tr
              key={mle.id || idx}
              data-testid={`team-history-mle-row-${idx}`}
              className="odd:bg-cockpit-slab"
            >
              <td className="p-2">{mle.year || '—'}</td>
              <td className="p-2">${mle.total?.toLocaleString() ?? '—'}</td>
              <td className="p-2">${mle.used?.toLocaleString() ?? '—'}</td>
              <td className="p-2">
                ${((mle.total ?? 0) - (mle.used ?? 0)).toLocaleString()}
              </td>
              <td className="p-2">{mle.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="text-white">
      <h3 className="text-lg font-semibold mb-2">Trade Exception Activity</h3>
      {renderTPEHistory()}

      <h3 className="mt-6 text-lg font-semibold">MLE Usage History</h3>
      {renderMLEHistory()}
    </div>
  );
};
