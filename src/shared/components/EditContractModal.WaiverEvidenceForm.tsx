import type { GovernedWaiverAvailability } from '@/features/architect/utils/waivers';
import type { SelectedContractAction } from './EditContractModal.types';

type GovernedWaiverEvidenceFormProps = {
  selectedAction: SelectedContractAction;
  availability: GovernedWaiverAvailability | null;
  leagueReceiptInput: string;
  leagueReceiptAt: string | null;
  onLeagueReceiptInputChange: (value: string) => void;
  writtenStretchElection: boolean;
  onWrittenStretchElectionChange: (value: boolean) => void;
  signedBuyoutAgreement: boolean;
  onSignedBuyoutAgreementChange: (value: boolean) => void;
};

export function GovernedWaiverEvidenceForm({
  selectedAction,
  availability,
  leagueReceiptInput,
  leagueReceiptAt,
  onLeagueReceiptInputChange,
  writtenStretchElection,
  onWrittenStretchElectionChange,
  signedBuyoutAgreement,
  onSignedBuyoutAgreementChange,
}: GovernedWaiverEvidenceFormProps) {
  if (!['waive', 'waiveStretch', 'buyout'].includes(selectedAction)) return null;

  const ready = availability?.status === 'ready';
  return (
    <section
      aria-labelledby="governed-waiver-evidence-title"
      className="rounded-lg border border-orange-500/25 bg-orange-500/10 p-4 space-y-3"
    >
      <div>
        <h4
          id="governed-waiver-evidence-title"
          className="text-sm font-semibold text-orange-100"
        >
          League waiver record
        </h4>
        <p className="mt-1 text-[11px] leading-relaxed text-orange-100/75">
          Player List removal is immediate when the League receives this
          irrevocable request. Financial responsibility continues through the
          exact 48-hour period, including weekends and holidays.
        </p>
      </div>

      <div
        data-testid="governed-waiver-availability"
        className="rounded border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/75"
      >
        <span className="font-medium text-white">
          {ready
            ? 'Contract information ready'
            : availability?.status === 'recorded'
              ? 'Waiver already recorded'
              : availability?.status === 'incompatible'
                ? 'Waiver unavailable'
                : 'Required contract information is missing'}
        </span>
        {!ready && (
          <span className="ml-1">
            {availability?.reasons[0] ||
              'Open a compatible saved Team Plan before recording this action.'}
          </span>
        )}
      </div>

      <div>
        <label
          htmlFor="governed-waiver-league-receipt"
          className="block text-xs font-medium text-white/85 mb-1"
        >
          League receipt — Eastern time
        </label>
        <input
          id="governed-waiver-league-receipt"
          data-testid="governed-waiver-league-receipt"
          type="datetime-local"
          step="1"
          value={leagueReceiptInput}
          onChange={(event) => onLeagueReceiptInputChange(event.target.value)}
          className="w-full rounded border border-white/20 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
        />
        <p className="mt-1 text-[11px] text-white/55">
          {leagueReceiptInput && !leagueReceiptAt
            ? 'Choose a valid Eastern time. The skipped daylight-saving hour cannot be used.'
            : leagueReceiptAt
              ? `Recorded as ${leagueReceiptAt}`
              : 'Enter the exact time shown on the League receipt.'}
        </p>
      </div>

      {selectedAction === 'waiveStretch' && (
        <label className="flex items-start gap-2 text-xs text-white/80">
          <input
            data-testid="governed-waiver-stretch-election"
            type="checkbox"
            checked={writtenStretchElection}
            onChange={(event) =>
              onWrittenStretchElectionChange(event.target.checked)
            }
            className="mt-0.5"
          />
          <span>
            A written Team Salary stretch election is on file. This changes
            Team Salary attribution only; player payments remain on their
            original schedule.
          </span>
        </label>
      )}

      {selectedAction === 'buyout' && (
        <label className="flex items-start gap-2 text-xs text-white/80">
          <input
            data-testid="governed-waiver-buyout-agreement"
            type="checkbox"
            checked={signedBuyoutAgreement}
            onChange={(event) =>
              onSignedBuyoutAgreementChange(event.target.checked)
            }
            className="mt-0.5"
          />
          <span>
            The written buyout agreement is signed by both the player and the
            Team. The amount below is the agreed reduction of protected Base
            Compensation.
          </span>
        </label>
      )}
    </section>
  );
}
