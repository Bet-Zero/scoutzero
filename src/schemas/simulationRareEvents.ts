/**
 * Light intake for rare money events in the SIMULATION baseline (V1 item D5).
 *
 * The private package builder reads an optional private events file. Each
 * event is a grievance exposure (CBA2-C07.4) or an outstanding Required
 * Tender to a First Round Pick (CBA2-C07.8) for one team on the world date:
 *
 * - `documented-liability` with an amount adds that amount to the team's
 *   Apron Team Salary, and the "unidentified exposure" assumption no longer
 *   covers that category for the team.
 * - `credible-unresolved` (no amount) is a signal: the team's Apron Team
 *   Salary book needs review instead of assuming the category away, so the
 *   package build stops until the event is resolved (recorded with its
 *   amount, or removed with a reason).
 *
 * Disabled Player Exception grants are post-V1 and are not taken here.
 */
import { z } from 'zod';
import { SimulationRareCategoryZ } from './simulationFinancialAssumptions';

export const SimulationRareEventZ = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    team: z.string().regex(/^[A-Z]{3}$/),
    category: SimulationRareCategoryZ,
    status: z.enum(['documented-liability', 'credible-unresolved']),
    /** Whole dollars; required for a documented liability, absent otherwise. */
    amount: z.number().int().min(0).max(1_000_000_000).optional(),
    label: z.string().min(1).max(200),
    effectiveFrom: z.string().date().nullable(),
    effectiveUntil: z.string().date().nullable(),
    evidenceReference: z.string().min(1),
  })
  .strict()
  .superRefine((event, ctx) => {
    if ((event.status === 'documented-liability') !== (event.amount != null))
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message:
          'A documented liability needs its amount; an unresolved signal has none.',
      });
    if (
      event.effectiveUntil &&
      (!event.effectiveFrom || event.effectiveUntil <= event.effectiveFrom)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveUntil'],
        message: 'The event must end after it starts.',
      });
  });
export type SimulationRareEvent = z.infer<typeof SimulationRareEventZ>;

export const SimulationRareEventsFileZ = z
  .object({
    version: z.literal(1),
    events: z.array(SimulationRareEventZ),
  })
  .strict()
  .superRefine((file, ctx) => {
    const ids = file.events.map((e) => e.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'Event ids must be unique.' });
  });

/** True when the event is in effect on the date (inclusive start, exclusive end). */
export function rareEventActiveOn(
  event: Pick<SimulationRareEvent, 'effectiveFrom' | 'effectiveUntil'>,
  date: string
): boolean {
  return (
    (!event.effectiveFrom || event.effectiveFrom <= date) &&
    (!event.effectiveUntil || date < event.effectiveUntil)
  );
}
