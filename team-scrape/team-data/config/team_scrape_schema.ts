// TEAM_SCRAPE_SCHEMA.ts
// What to scrape from a TEAM page (no player bios/contracts).
// Use this to design selectors. Player refs are placeholders only.

import { z } from 'zod';

/** ---- Types ---- **/

export const SeasonStr = z.string().regex(/^\d{4}-\d{2}$/); // e.g. "2025-26"

export const TeamId = z.object({
  teamCode: z.string().min(2).max(4), // "LAL"
  teamName: z.string(), // "Los Angeles Lakers"
  season: SeasonStr, // "2025-26" (context of the page)
});

export const RosterRef = z.object({
  // DO NOT scrape player bio/contract here.
  // If page exposes a link or slug, capture it ONLY to help map -> playerId later.
  playerId: z.string().optional(), // to be filled by your mapper later
  displayName: z.string().optional(), // e.g. "LeBron James" (temporary)
  sourceUrl: z.string().url().optional(), // profile URL to help resolve playerId
});

export const DeadCapItem = z.object({
  // Team-level dead money (from waives/stretch/buyouts)
  playerId: z.string().optional(), // placeholder; resolve later
  displayName: z.string().optional(),
  season: SeasonStr,
  amount: z.number(), // USD
  reason: z
    .enum(['waived', 'stretched', 'buyout', 'provision', 'other'])
    .optional(),
  notes: z.string().optional(),
  // If page shows multi-year schedules, include them:
  schedule: z
    .array(
      z.object({
        season: SeasonStr,
        amount: z.number(),
      })
    )
    .optional(),
});

export const CapHoldItem = z.object({
  // Free-agent cap holds retained by the team
  playerId: z.string().optional(), // placeholder; resolve later
  displayName: z.string().optional(),
  type: z.enum(['UFA', 'RFA', 'Two-way', 'Draft Pick', 'FA Cap Hold', 'Other']).optional(),
  rights: z.enum(['Bird', 'Early Bird', 'Non-Bird']).optional(),
  capHoldAmount: z.number(), // USD
  notes: z.string().optional(),
  season: SeasonStr.optional(),
  sourceUrl: z.string().url().optional(), // URL to player page
});

export const MleLike = z.object({
  // Only one of these (mle | taxpayer_mle | room) should typically be active
  type: z.enum(['Non-Taxpayer', 'Taxpayer', 'Room']),
  totalAmount: z.number(),
  usedAmount: z.number(),
  remainingAmount: z.number(),
  available: z.boolean(),
  expiresOn: z.string().optional(), // ISO date if shown
  notes: z.string().optional(),
});

export const Bae = z.object({
  totalAmount: z.number(),
  usedAmount: z.number(),
  remainingAmount: z.number(),
  available: z.boolean(),
  expiresOn: z.string().optional(),
  notes: z.string().optional(),
});

export const Dpe = z.object({
  // Disabled Player Exception (rare)
  totalAmount: z.number(),
  createdOn: z.string().optional(),
  expiresOn: z.string().optional(),
  notes: z.string().optional(),
});

export const Tpe = z.object({
  // Trade Player Exception — can be multiple
  id: z.string(), // stable key like "TPE-LAL-2025-07-12-#1" or page id
  totalAmount: z.number(),
  usedAmount: z.number(),
  remainingAmount: z.number(),
  createdFrom: z.string().optional(), // trade note if shown
  expiresOn: z.string().optional(),
  notes: z.string().optional(),
});

export const Exceptions = z.object({
  // Keep keys explicit to match your world snapshot shape
  mle: MleLike.optional(), // Non-Taxpayer MLE
  taxpayerMle: MleLike.optional(), // Taxpayer MLE (alt to mle)
  room: MleLike.optional(), // Room MLE (mutually exclusive with MLE/TPMLE)
  bae: Bae.optional(),
  dpe: Dpe.optional(),
  tpe: z.array(Tpe).default([]), // multiple
});

export const DraftPick = z.object({
  year: z.number(), // 2025
  round: z.union([z.literal(1), z.literal(2)]),
  status: z.enum(['own', 'incoming', 'outgoing', 'contested', 'swap', 'unknown']),
  originalTeam: z.string().optional(), // where it started
  currentOwner: z.string().optional(), // who holds it now (often this team)
  via: z.string().optional(), // "via BOS" etc.
  pickNumber: z.number().optional(), // if known
  protection: z.string().optional(), // "top-10 protected", etc.
  conveysIf: z.string().optional(), // textual conveyance logic if shown
  notes: z.string().optional(),
  // Additional fields from parser
  detailUrl: z.string().optional(),
  title: z.string().optional(),
  contendingTeams: z.array(z.string()).optional(),
  tradedOn: z.string().optional(),
  fromTeams: z.array(z.string()).optional(),
  toTeams: z.array(z.string()).optional(),
  protections: z.string().optional(),
});

export const Totals = z.object({
  // Team-level rollups shown on team pages (scrape if present; otherwise compute later)
  activeSalary: z.number().optional(),
  deadCapTotal: z.number().optional(),
  capHoldsTotal: z.number().optional(),
  totalSalary: z.number().optional(), // active + dead + etc.
  guaranteedSalary: z.number().optional(),
  salaryCap: z.number().optional(), // league cap line (page may display)
  capSpace: z.number().optional(), // negative means over the cap
  luxuryTaxLine: z.number().optional(),
  taxSpace: z.number().optional(),
  firstApronLine: z.number().optional(),
  firstApronRoom: z.number().optional(),
  secondApronLine: z.number().optional(),
  secondApronRoom: z.number().optional(),
  firstApronTriggered: z.boolean().optional(),
  secondApronTriggered: z.boolean().optional(),
  hardCappedAt: z.enum(['none', 'firstApron', 'secondApron']).optional(),
  hardCapReason: z.string().optional(),
  incompleteRosterCharges: z.number().optional(),
  twoWayCount: z.number().optional(), // if page shows counts
  rosterCount: z.number().optional(),
  likelyIncentives: z.number().optional(),
  unlikelyIncentives: z.number().optional(),
});

export const TeamSourceMeta = z.object({
  provider: z.string(), // e.g. "SalarySwish"
  teamPageUrl: z.string().url(),
  scrapedAt: z.string(), // ISO
});

export const BaseTeamDoc = z.object({
  pathHint: z.string().optional(), // e.g. "/architect/baseTeams/LAL" (for dev only)
  ...TeamId.shape,
  roster: z.array(RosterRef).default([]), // ONLY refs/placeholders; no salary rows here
  deadCap: z.array(DeadCapItem).default([]),
  capHolds: z.array(CapHoldItem).default([]),
  exceptions: Exceptions.default({ tpe: [] }),
  draftPicks: z.array(DraftPick).default([]),
  totals: Totals.default({}),
  source: TeamSourceMeta,
  lastUpdated: z.string(),
  version: z.string().default('1.0'),
});

export type BaseTeamDoc = z.infer<typeof BaseTeamDoc>;
