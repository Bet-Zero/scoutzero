import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ModeTag } from './ValidationStateHeader';
import { TradeSummaryPanel } from './TradeSummaryPanel';
import { TradeLegalChecker } from './TradeLegalChecker';
import { TradeExceptionDashboard } from './TradeExceptionDashboard';
import { FaExceptionTracker } from './FaExceptionTracker';
import { TradeSalaryCalculator } from './TradeSalaryCalculator';
import { TradeReceiptPanel } from './TradeReceiptPanel';
import { getOfficialSalaryMatchingSnapshot } from './utils/getOfficialSalaryMatchingSnapshot';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import { EntitlementHealthPanel } from '@/features/architect/admin/EntitlementHealthPanel';
import type {
  CapSettingsLike,
  PreviewAuthorityLike,
  SnapshotValidationDetailsLike,
  TeamEntitlementLike,
  TeamCoreLike,
  TeamLike,
  TeamPlayerLike,
  TpeLike,
} from './validationPresentationTypes';
import type { PickRuleDoc } from '@/features/architect/utils/entitlements/pickRulesResolver';

interface ValidationDetailsPanelProps {
  hasValidatorResult?: boolean;
  isValidating?: boolean;
  previewAuthority?: PreviewAuthorityLike | null;
  snapshotValidationDetails?: SnapshotValidationDetailsLike | null;
  teams?: TeamLike[];
  forceTrade?: boolean;
  calculatorTeamIndex?: number;
  incomingAssets?: Array<{ players?: TeamPlayerLike[]; entitlements?: TeamEntitlementLike[] }>;
  salaryOut?: number[];
  capProjections?: CapSettingsLike | null;
  yearKey?: string | number | null;
  onCalculatorTeamChange?: ((teamIndex: number) => void) | null;
  pickRulesById?: Record<string, PickRuleDoc>;
  showSntInjector?: boolean;
  hasInjectedSntPlayers?: boolean;
  onInjectSntPlayers?: (() => void) | null;
  onClearInjectedSntPlayers?: (() => void) | null;
}

interface SectionHeaderProps {
  title: string;
  mode: string;
  children?: React.ReactNode;
}

const SectionHeader = ({ title, mode, children }: SectionHeaderProps) => (
  <div className="border-b border-white/10 pb-2 mb-3">
    <div className="flex items-center gap-2 mb-1">
      <h4 className="font-medium text-sm text-white/90">{title}</h4>
      <ModeTag mode={mode} />
    </div>
    {children && <div className="text-xs text-white/50">{children}</div>}
  </div>
);

function getCalculatorTpes(team: TeamCoreLike | null | undefined): TpeLike[] {
  return getTeamTpeList(
    team as Parameters<typeof getTeamTpeList>[0]
  ).map((tpe): TpeLike => ({
    id: tpe.id ?? undefined,
    amount: tpe.amount ?? undefined,
    remaining: tpe.remaining ?? undefined,
    totalAmount: tpe.totalAmount ?? undefined,
    remainingAmount: tpe.remainingAmount ?? undefined,
    name: tpe.name ?? undefined,
    createdFrom: tpe.createdFrom ?? undefined,
    expirationDate: tpe.expirationDate ?? undefined,
    expiresOn: tpe.expiresOn ?? undefined,
  }));
}

const NotValidatedCallout = () => (
  <div
    className="p-4 bg-amber-900/20 border border-amber-600/30 rounded-lg text-center"
    data-testid="not-validated-callout"
  >
    <div className="text-amber-300 font-medium mb-1">
      No Validation Results Available
    </div>
    <div className="text-sm text-amber-200/70">
      Run <span className="font-semibold">Validate Trade</span> to generate
      official results.
    </div>
  </div>
);

export const ValidationDetailsPanel = ({
  hasValidatorResult = false,
  isValidating = false,
  previewAuthority = null,
  snapshotValidationDetails = null,
  teams = [],
  forceTrade = false,
  calculatorTeamIndex = 0,
  incomingAssets = [],
  salaryOut = [],
  capProjections = null,
  yearKey = null,
  onCalculatorTeamChange = null,
  pickRulesById = {},
  showSntInjector = false,
  hasInjectedSntPlayers = false,
  onInjectSntPlayers = null,
  onClearInjectedSntPlayers = null,
}: ValidationDetailsPanelProps) => {
  const [productionExpanded, setProductionExpanded] = useState(false);
  const [devToolsExpanded, setDevToolsExpanded] = useState(false);

  const teamOptions = useMemo(
    () =>
      teams.reduce<Array<{ idx: number; label: string }>>((acc, team, index) => {
        if (team.team) {
          acc.push({
            idx: index,
            label: team.team.nickname || team.team.teamName || `Team ${index + 1}`,
          });
        }
        return acc;
      }, []),
    [teams]
  );

  const hasMultipleTeams = teamOptions.length > 1;

  const entitlementsByTeam = useMemo(() => {
    const map: Record<string, Record<string, unknown>[]> = {};
    for (const team of teams) {
      if (team.team?.id && Array.isArray(team.team.entitlements)) {
        map[team.team.id] = team.team.entitlements.map(e => ({ ...e }));
      }
    }
    return map;
  }, [teams]);

  const selectedTeam = teams[calculatorTeamIndex];
  const teamResult = snapshotValidationDetails?.teamResults?.[calculatorTeamIndex];
  const officialSnapshot = getOfficialSalaryMatchingSnapshot(teamResult ? { ...teamResult } : null);

  return (
    <div className="mt-6 space-y-4" data-testid="validation-details-panel">
      <div className="border border-white/10 rounded-lg overflow-hidden bg-[#111]">
        <button
          type="button"
          onClick={() => setProductionExpanded(!productionExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#111] hover:bg-[#1a1a1a] text-sm font-medium text-white/80 transition-colors"
          aria-expanded={productionExpanded}
          aria-controls="validation-results-content"
        >
          <span className="flex items-center gap-2">
            <span>📋</span>
            <span>Validation Results</span>
            {hasValidatorResult && (
              <span className="text-xs text-green-400">✓ Results available</span>
            )}
          </span>
          {productionExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {productionExpanded && (
          <div
            id="validation-results-content"
            className="p-4 border-t border-white/10"
          >
            {!hasValidatorResult ? (
              <NotValidatedCallout />
            ) : (
              <div className="space-y-6">
                <section data-testid="section-validation-summary">
                  <SectionHeader title="Validation Summary" mode="OFFICIAL">
                    Per-team matching status and trade legality
                  </SectionHeader>
                  <TradeSummaryPanel
                    previewAuthority={previewAuthority}
                    snapshotValidationDetails={snapshotValidationDetails}
                    teams={teams}
                    forceTrade={forceTrade}
                    isValidating={isValidating}
                    pickRulesById={pickRulesById}
                  />
                </section>

                {snapshotValidationDetails?.teamResults && (
                  <section data-testid="section-rule-compliance">
                    <SectionHeader
                      title="Rule Compliance Overview"
                      mode="OFFICIAL"
                    >
                      CBA rule pass/fail per team (preview only — snapshot stage here, post-state preview runs locally, world-state checks run at apply time)
                    </SectionHeader>
                    <TradeLegalChecker
                      teamResults={snapshotValidationDetails.teamResults}
                      capSettings={snapshotValidationDetails.capSettings}
                    />
                  </section>
                )}

                <section data-testid="section-exception-analysis">
                  <SectionHeader title="Trade Exception Analysis" mode="OFFICIAL">
                    TPE creation, usage, FA exceptions, and existing exceptions
                  </SectionHeader>
                  <div className="space-y-4">
                    <TradeExceptionDashboard
                      snapshotValidationDetails={snapshotValidationDetails}
                      teams={teams}
                    />
                    <FaExceptionTracker
                      snapshotValidationDetails={snapshotValidationDetails}
                      teams={teams}
                    />
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border border-amber-500/30 rounded-lg overflow-hidden bg-[#111]">
        <button
          type="button"
          onClick={() => setDevToolsExpanded(!devToolsExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#0d0906] hover:bg-[#1a1408] text-sm font-medium text-amber-300/70 transition-colors"
          aria-expanded={devToolsExpanded}
          aria-controls="dev-tools-content"
        >
          <span className="flex items-center gap-2">
            <span>🛠️</span>
            <span>Development Tools</span>
            <span className="text-[10px] text-amber-400/50 italic ml-1">
              testing & debug
            </span>
          </span>
          {devToolsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {devToolsExpanded && (
          <div id="dev-tools-content" className="p-4 border-t border-amber-500/20">
            <div className="space-y-6">
              {showSntInjector && (
                <section data-testid="section-snt-injector">
                  <SectionHeader title="S&T Runtime Injector" mode="DEBUG">
                    Inject one eligible and one ineligible synthetic player for
                    Sign-and-Trade runtime verification.
                  </SectionHeader>
                  <div className="rounded border border-amber-500/30 bg-[#120e09] p-3 text-xs text-amber-100/80 space-y-3">
                    <div>
                      Enabled via local flag:{' '}
                      <code className="font-mono text-amber-200">
                        hz.dev.injectSntPlayers=true
                      </code>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onInjectSntPlayers?.()}
                        className="rounded bg-amber-700/70 hover:bg-amber-600/70 px-3 py-1.5 text-xs font-medium text-amber-100"
                      >
                        Inject S&T Test Players
                      </button>
                      <button
                        type="button"
                        onClick={() => onClearInjectedSntPlayers?.()}
                        disabled={!hasInjectedSntPlayers}
                        className={`rounded px-3 py-1.5 text-xs font-medium ${
                          hasInjectedSntPlayers
                            ? 'bg-neutral-700 hover:bg-neutral-600 text-white'
                            : 'bg-neutral-800 text-white/40 cursor-not-allowed'
                        }`}
                      >
                        Clear Injected Players
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {!hasValidatorResult ? (
                <NotValidatedCallout />
              ) : (
                <>
                  {selectedTeam?.team && (
                    <section data-testid="section-salary-calculator">
                      <SectionHeader title="Salary Calculator" mode="EXPLORATORY">
                        Sandbox for testing salary matching scenarios (validator
                        is authoritative)
                      </SectionHeader>

                      {hasMultipleTeams && (
                        <div className="mb-3">
                          <select
                            value={calculatorTeamIndex}
                            onChange={(event) =>
                              onCalculatorTeamChange?.(Number(event.target.value))
                            }
                            className="bg-[#222] border border-white/20 rounded px-2 py-1 text-xs"
                          >
                            {teamOptions.map((item) => (
                              <option key={item.idx} value={item.idx}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <TradeSalaryCalculator
                        teamSalary={
                          selectedTeam.team?.teamTotalSalary ||
                          selectedTeam.team?.totalSalary ||
                          0
                        }
                        outgoingSalary={salaryOut[calculatorTeamIndex] || 0}
                        incomingPlayers={incomingAssets[calculatorTeamIndex]?.players || []}
                        tpes={getCalculatorTpes(selectedTeam.team)}
                        capSettings={snapshotValidationDetails?.capSettings || capProjections}
                        yearKey={yearKey}
                        validatorAllowableIncoming={
                          officialSnapshot.allowableIncoming
                        }
                        validatorRule={officialSnapshot.ruleApplied}
                        hasValidatorResult={officialSnapshot.hasValidator}
                        validatorSkipReason={officialSnapshot.skipReason}
                      />
                    </section>
                  )}

                  {/* TMUI-16: gate the whole section on the receipt flag so the
                      header doesn't render alone when the panel is disabled */}
                  {import.meta.env.VITE_SHOW_TRADE_RECEIPT === 'true' && (
                    <section data-testid="section-trade-receipt">
                      <SectionHeader title="Trade Receipt" mode="DEBUG">
                        Developer diagnostic data — not required reading
                      </SectionHeader>
                      <TradeReceiptPanel
                        receipt={snapshotValidationDetails?.tradeReceipt}
                        pickRulesById={pickRulesById}
                      />
                    </section>
                  )}

                  {Object.keys(entitlementsByTeam).length > 0 && (
                    <section data-testid="section-entitlement-health">
                      <SectionHeader title="Exclusivity Health" mode="DEBUG">
                        Scan all teams&apos; entitlements for integrity issues
                      </SectionHeader>
                      <EntitlementHealthPanel
                        entitlementsByTeam={entitlementsByTeam}
                      />
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

