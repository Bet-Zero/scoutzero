import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import type { TradeApronRestrictionEvaluation } from '@/features/architect/utils/tradeMachine/utils/tradeApronRestrictions';

type TradeApronRestrictionReceiptProps = {
  evaluation: TradeApronRestrictionEvaluation;
  teamCode?: string;
};

export function TradeApronRestrictionReceipt({
  evaluation,
  teamCode,
}: TradeApronRestrictionReceiptProps) {
  if (evaluation.status === 'NOT_APPLICABLE') return null;
  const attachedRows = [
    ...new Set(
      evaluation.attachedRestrictions.map((trigger) => trigger.restrictionRow)
    ),
  ];
  const attributedTpeIds = new Set(
    evaluation.attachedRestrictions.flatMap((trigger) =>
      trigger.tpeTiming ? [trigger.tpeTiming.tpeId] : []
    )
  );

  return (
    <div
      className="p-2 mb-2 rounded border border-cockpit-watch/30 bg-cockpit-watch/10 space-y-1"
      data-testid={`trade-apron-restriction-${teamCode ?? 'unknown'}`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-cockpit-watch">
          Apron restriction ·{' '}
          {attachedRows.length > 1
            ? `Rows ${attachedRows.join(' + ')}`
            : `Row ${attachedRows[0] ?? evaluation.restrictionRow ?? 'needs input'}`}
        </span>
        <span
          className={
            evaluation.status === 'PASS'
              ? 'text-cockpit-safe'
              : evaluation.status === 'FAIL'
                ? 'text-cockpit-danger'
                : 'text-cockpit-watch'
          }
        >
          {evaluation.status}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[11px] text-cockpit-text-secondary">
        <span>Post-trade Apron Team Salary</span>
        <span className="font-mono text-cockpit-text-primary">
          {evaluation.postTransactionApronTeamSalary == null
            ? 'Needs input'
            : formatCurrency(evaluation.postTransactionApronTeamSalary)}
        </span>
        <span>
          {evaluation.apronLevel === 'FIRST_APRON'
            ? 'Controlling First Apron ceiling'
            : evaluation.apronLevel === 'SECOND_APRON'
              ? 'Controlling Second Apron ceiling'
              : 'Controlling Apron ceiling'}
        </span>
        <span className="font-mono text-cockpit-text-primary">
          {evaluation.ceiling == null
            ? 'Needs input'
            : formatCurrency(evaluation.ceiling)}
        </span>
      </div>
      {evaluation.attachedRestrictions.map((trigger) => (
        <div
          key={`${trigger.restrictionRow}:${trigger.componentId}`}
          className="rounded border border-cockpit-border/60 bg-cockpit-panel/40 px-2 py-1 text-[10px] text-cockpit-text-muted"
        >
          <div className="font-medium text-cockpit-text-primary">
            Row {trigger.restrictionRow} ·{' '}
            {trigger.componentKind === 'CASH'
              ? `Cash payment${
                  trigger.cashAmountCents == null
                    ? ''
                    : ` · ${formatCurrency(trigger.cashAmountCents / 100)}`
                }`
              : `${
                  trigger.componentKind === 'SIGN_AND_TRADE'
                    ? 'Sign-and-trade'
                    : trigger.componentKind === 'HELD_STANDARD_TPE'
                    ? 'Held Standard TPE'
                    : 'Aggregated Standard TPE'
                } component ${trigger.componentId}`}
          </div>
          {trigger.incomingPlayers.length > 0 && (
            <div>
              Players:{' '}
              {trigger.incomingPlayers
                .map((player) => `${player.playerName} (${player.playerId})`)
                .join(', ')}
            </div>
          )}
          {trigger.tpeTiming && (
            <div>
              Held TPE {trigger.tpeTiming.tpeId} · created{' '}
              {trigger.tpeTiming.createdOn} · expires{' '}
              {trigger.tpeTiming.expiresOn}
            </div>
          )}
          {trigger.regularSeasonClosing && (
            <div>
              Creation-season regular season ended{' '}
              {trigger.regularSeasonClosing}
            </div>
          )}
          <div>
            Authority {trigger.proof.calendarRecordId} ·{' '}
            {trigger.proof.apronRecordId}
          </div>
          <div>{trigger.canonLeafIds.join(' · ')}</div>
        </div>
      ))}
      {evaluation.tpeTimings
        .filter((timing) => !attributedTpeIds.has(timing.tpeId))
        .map((timing) => (
          <div
            key={timing.tpeId}
            className="text-[11px] text-cockpit-text-muted"
          >
            Held TPE {timing.tpeId} · created {timing.createdOn} · expires{' '}
            {timing.expiresOn}
          </div>
        ))}
      {evaluation.hardCapWillPersist && (
        <div className="text-[11px] text-cockpit-safe">
          Hard cap persists through Salary Cap Year {evaluation.salaryCapYear}.
        </div>
      )}
      {evaluation.missingInputs.length > 0 && (
        <div className="text-[11px] text-cockpit-watch">
          Needs: {evaluation.missingInputs.join(', ')}
        </div>
      )}
      {evaluation.violations.map((violation) => (
        <div key={violation} className="text-[11px] text-cockpit-danger">
          {violation}
        </div>
      ))}
      <div className="text-[10px] text-cockpit-text-ghost">
        {evaluation.canonLeafIds.join(' · ')}
      </div>
    </div>
  );
}
