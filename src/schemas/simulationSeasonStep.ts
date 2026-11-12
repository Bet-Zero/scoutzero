/**
 * One SIMULATION season step for the draft inventory (V1 item C1): the input
 * that moves a June 5, 2026 world to July 1, 2026. Built privately from
 * public facts; it never certifies NBA history.
 */
import { z } from 'zod';
import { GovernedDraftWorldBaselineZ } from './governedDraftWorld';

const TeamZ = z.string().regex(/^[A-Z]{3}$/);

export const SimulationDraftOrderSlotZ = z
  .object({
    slot: z.number().int().min(1).max(30),
    /** The team whose own first-round pick sits at this slot. */
    originalTeam: TeamZ,
    /** Who held that pick when the draft began, before draft-night trades. */
    holderBeforeDraft: TeamZ,
  })
  .strict();

export const SimulationSeasonStepZ = z
  .object({
    version: z.literal(1),
    classification: z.literal('simulation'),
    fromSeason: z.string().regex(/^\d{4}-\d{2}$/),
    toSeason: z.string().regex(/^\d{4}-\d{2}$/),
    /** World date after the step, midnight ET as an instant. */
    asOf: z.string().datetime({ offset: true }),
    draft: z
      .object({
        year: z.number().int().min(2026).max(2100),
        completedAt: z.string().datetime({ offset: true }),
        order: z.array(SimulationDraftOrderSlotZ).length(30),
        sources: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    /** First day of the next draft, a named SIMULATION assumption. */
    nextDraftStartsAt: z.string().datetime({ offset: true }),
    /** The newly opened draft year's admitted firsts and their Apron inputs. */
    opened: z
      .object({
        year: z.number().int(),
        records: GovernedDraftWorldBaselineZ.shape.records,
        apron: GovernedDraftWorldBaselineZ.shape.apron,
      })
      .strict(),
  })
  .strict()
  .superRefine((step, ctx) => {
    const slots = step.draft.order.map((s) => s.slot);
    const teams = step.draft.order.map((s) => s.originalTeam);
    if (
      new Set(slots).size !== 30 ||
      slots.some((slot, i) => slot !== i + 1) ||
      new Set(teams).size !== 30
    )
      ctx.addIssue({
        code: 'custom',
        path: ['draft', 'order'],
        message: 'The order must list slots 1-30 once, one original team each.',
      });
    if (step.opened.year !== step.draft.year + 7)
      ctx.addIssue({
        code: 'custom',
        path: ['opened', 'year'],
        message: 'The opened year must be seven drafts after the resolved one.',
      });
    if (
      step.opened.records.some(
        (r) => r.ownership.pick.draftYear !== step.opened.year
      ) ||
      step.opened.apron.some(
        (a) => a.originalPick.draftYear !== step.opened.year
      )
    )
      ctx.addIssue({
        code: 'custom',
        path: ['opened'],
        message: 'Opened records must all belong to the opened year.',
      });
  });
export type SimulationSeasonStep = z.infer<typeof SimulationSeasonStepZ>;
