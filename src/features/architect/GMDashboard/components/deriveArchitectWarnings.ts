import type { ArchitectWorkspaceContext } from '../hooks/useArchitectWorkspaceContext';

export type ArchitectWarningTone = 'warning' | 'danger' | 'muted';

export interface ArchitectWarningItem {
  id: string;
  title: string;
  detail: string;
  tone: ArchitectWarningTone;
}

const formatMoney = (value: number) =>
  `$${(Math.abs(value) / 1_000_000).toFixed(1)}M`;

export function deriveArchitectWarnings(
  context: ArchitectWorkspaceContext
): ArchitectWarningItem[] {
  const warnings: ArchitectWarningItem[] = [];

  if (context.status.hasError && context.status.errorMessage) {
    warnings.push({
      id: 'load-error',
      title: 'Workspace error',
      detail: context.status.errorMessage,
      tone: 'danger',
    });
  }

  if (context.seasons.viewingSeasonDiffersFromWorldSeason === true) {
    warnings.push({
      id: 'season-mismatch',
      title: 'Season mismatch',
      detail: `Viewing ${
        context.seasons.selectedViewingSeasonLabel ?? 'selected season'
      } while the world is ${
        context.seasons.authoritativeWorldSeasonLabel ?? 'another season'
      }.`,
      tone: 'warning',
    });
  }

  if (context.cap.status === 'available') {
    if (context.cap.isAboveSecondApron) {
      warnings.push({
        id: 'second-apron',
        title: 'Second apron posture',
        detail: `${formatMoney(context.cap.secondApronSpace)} over the second apron.`,
        tone: 'danger',
      });
    } else if (context.cap.isAtOrAboveFirstApron) {
      warnings.push({
        id: 'first-apron',
        title: 'First apron posture',
        detail: `${formatMoney(context.cap.firstApronSpace)} over the first apron.`,
        tone: 'warning',
      });
    } else if (context.cap.isOverTax) {
      warnings.push({
        id: 'tax',
        title: 'Tax posture',
        detail: `${formatMoney(context.cap.taxSpace)} over the luxury tax.`,
        tone: 'warning',
      });
    } else if (context.cap.isOverCap) {
      warnings.push({
        id: 'over-cap',
        title: 'Over cap',
        detail: `${formatMoney(context.cap.capSpace)} over the salary cap.`,
        tone: 'muted',
      });
    }
  }

  if (context.roster.status === 'available') {
    if (context.roster.count < 14) {
      warnings.push({
        id: 'roster-low',
        title: 'Roster count low',
        detail: `${context.roster.count} players on the current roster.`,
        tone: 'warning',
      });
    } else if (context.roster.count > 15) {
      warnings.push({
        id: 'roster-high',
        title: 'Roster count high',
        detail: `${context.roster.count} players on the current roster.`,
        tone: 'warning',
      });
    }
  }

  return warnings;
}
