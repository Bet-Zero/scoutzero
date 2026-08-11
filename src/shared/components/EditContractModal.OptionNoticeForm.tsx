import type {
  GovernedOptionNoticeInput,
  GovernedOptionNoticeMethod,
} from '@/schemas/governedOptionDecision';
import type { GovernedOptionDecisionAvailability } from '@/features/architect/utils/optionDecisions';

type OptionNoticeFormProps = {
  availability: GovernedOptionDecisionAvailability;
  value: GovernedOptionNoticeInput;
  onChange: (value: GovernedOptionNoticeInput) => void;
};

const METHOD_LABELS: Record<GovernedOptionNoticeMethod, string> = {
  'personal-delivery': 'Personal delivery',
  email: 'Email',
  'certified-mail': 'Certified mail',
  'registered-mail': 'Registered mail',
  facsimile: 'Facsimile',
};

export const GovernedOptionNoticeForm = ({
  availability,
  value,
  onChange,
}: OptionNoticeFormProps) => {
  const requirements = availability.noticeRequirements;
  if (!requirements) return null;

  const set = <Key extends keyof GovernedOptionNoticeInput>(
    key: Key,
    nextValue: GovernedOptionNoticeInput[Key]
  ) => onChange({ ...value, [key]: nextValue });

  return (
    <section
      className="mb-6 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-4"
      data-testid="governed-option-notice-form"
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
        Required notice evidence
      </div>
      <p className="mt-1 text-xs leading-relaxed text-white/60">
        Enter exact zoned instants, including the UTC offset. The governed
        window is{' '}
        <span className="text-white/85">{requirements.windowOpensAt}</span>{' '}
        through <span className="text-white/85">{requirements.deadline}</span>.
        No date is inferred.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-white/70">
          Notice delivered at
          <input
            data-testid="option-notice-delivered-at"
            value={value.deliveredAt}
            onChange={(event) => set('deliveredAt', event.target.value)}
            placeholder="2026-06-29T16:30:00-04:00"
            className="mt-1 w-full rounded border border-white/15 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-amber-400/50"
          />
        </label>
        <label className="text-xs text-white/70">
          Delivery method
          <select
            data-testid="option-notice-method"
            value={value.method}
            onChange={(event) =>
              set('method', event.target.value as GovernedOptionNoticeMethod)
            }
            className="mt-1 w-full rounded border border-white/15 bg-[#111] px-3 py-2 text-xs text-white outline-none focus:border-amber-400/50"
          >
            {requirements.allowedMethods.map((method) => (
              <option key={method} value={method}>
                {METHOD_LABELS[method]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-white/70">
          NBA received at
          <input
            data-testid="option-notice-league-received-at"
            value={value.leagueReceivedAt}
            onChange={(event) => set('leagueReceivedAt', event.target.value)}
            placeholder="2026-06-29T16:31:00-04:00"
            className="mt-1 w-full rounded border border-white/15 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-amber-400/50"
          />
        </label>
        <label className="text-xs text-white/70">
          Players Association forwarded at
          <input
            data-testid="option-notice-pa-forwarded-at"
            value={value.playersAssociationForwardedAt}
            onChange={(event) =>
              set('playersAssociationForwardedAt', event.target.value)
            }
            placeholder="2026-06-30T09:00:00-04:00"
            className="mt-1 w-full rounded border border-white/15 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-amber-400/50"
          />
        </label>
      </div>

      <div className="mt-3 rounded border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65">
        Recipient:{' '}
        <span className="font-mono text-white/90">
          {requirements.recipientId}
        </span>{' '}
        ({requirements.recipientRole})
      </div>
    </section>
  );
};
