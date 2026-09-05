/** Offline PST evidence/lifecycle contracts. No product authority is implied. */
import { z } from 'zod';

export const PstEvidenceSpanZ = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    byteStart: z.number().int().nonnegative(),
    byteEnd: z.number().int().nonnegative(),
  })
  .strict();

/** Parsed document tree plus original-byte locators; implicit HTML nodes are explicit. */
export const PstEvidenceNodeZ = z
  .object({
    id: z.string().min(1),
    parentId: z.string().nullable(),
    children: z.array(z.string()),
    type: z.string(),
    tag: z.string().nullable(),
    attributes: z.record(z.string(), z.string()),
    data: z.string().nullable(),
    span: PstEvidenceSpanZ.nullable(),
  })
  .strict();

export const PstObservedTextZ = z
  .object({
    nodeId: z.string(),
    text: z.string(),
    span: PstEvidenceSpanZ.nullable(),
  })
  .strict();

export const PstObservedCellZ = z
  .object({
    id: z.string(),
    nodeId: z.string(),
    column: z.number().int().nonnegative(),
    columnSpan: z.number().int().positive(),
    rowSpan: z.number().int().positive(),
    text: z.string(),
    attributes: z.record(z.string(), z.string()),
    displayTeam: z.string().nullable(),
    displayText: z.string(),
    signals: z.array(
      z
        .object({
          nodeId: z.string(),
          classes: z.array(z.string()),
          text: z.string(),
        })
        .strict()
    ),
    narratives: z.array(
      PstObservedTextZ.extend({
        highlights: z.array(PstObservedTextZ),
      }).strict()
    ),
    links: z.array(
      z
        .object({
          nodeId: z.string(),
          text: z.string(),
          href: z.string(),
          resolvedUrl: z.string(),
        })
        .strict()
    ),
  })
  .strict();

export const PstObservedRowZ = z
  .object({
    id: z.string(),
    nodeId: z.string(),
    tableId: z.string(),
    index: z.number().int().nonnegative(),
    year: z.number().int().nullable(),
    round: z.number().int().nullable(),
    originalTeam: z.string().nullable(),
    assetId: z.string().nullable(),
    role: z.enum(['asset', 'pooled-allocation', 'header', 'unresolved']),
    originalCellId: z.string().nullable(),
    transactionCellIds: z.array(z.string()),
    outcome: z
      .object({
        overall: z.number().int(),
        roundPosition: z.string(),
        player: z.string(),
        cellIds: z.array(z.string()),
      })
      .strict()
      .nullable(),
    cells: z.array(PstObservedCellZ),
  })
  .strict();

export const PstObservedPageZ = z
  .object({
    id: z.string(),
    url: z.string().url(),
    rawPath: z.string(),
    rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
    captureStartedAt: z.string(),
    captureCompletedAt: z.string(),
    pstLastUpdated: z.string().nullable(),
    nodes: z.array(PstEvidenceNodeZ),
    tables: z.array(
      z
        .object({
          id: z.string(),
          nodeId: z.string(),
          year: z.number().int().nullable(),
          rowIds: z.array(z.string()),
        })
        .strict()
    ),
    rows: z.array(PstObservedRowZ),
  })
  .strict();

export type PstEvidenceSpan = z.infer<typeof PstEvidenceSpanZ>;
export type PstEvidenceNode = z.infer<typeof PstEvidenceNodeZ>;
export type PstObservedText = z.infer<typeof PstObservedTextZ>;
export type PstObservedCell = z.infer<typeof PstObservedCellZ>;
export type PstObservedRow = z.infer<typeof PstObservedRowZ>;
export type PstObservedPage = z.infer<typeof PstObservedPageZ>;

export type PstTerm = {
  kind:
    | 'group'
    | 'protection'
    | 'selection'
    | 'swap'
    | 'dependency'
    | 'alternative'
    | 'replacement'
    | 'election'
    | 'relinquishment'
    | 'outcome'
    | 'pick'
    | 'context';
  text: string;
  start: number;
  end: number;
  parameters: Record<
    string,
    string | number | boolean | null | string[] | number[] | number[][]
  >;
  children: PstTerm[];
};
export const PstTermZ: z.ZodType<PstTerm> = z.lazy(() =>
  z
    .object({
      kind: z.enum([
        'group',
        'protection',
        'selection',
        'swap',
        'dependency',
        'alternative',
        'replacement',
        'election',
        'relinquishment',
        'outcome',
        'pick',
        'context',
      ]),
      text: z.string(),
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
      parameters: z.record(
        z.string(),
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
          z.array(z.string()),
          z.array(z.number()),
          z.array(z.array(z.number())),
        ])
      ),
      children: z.array(PstTermZ),
    })
    .strict()
);

export const PstClauseZ = z
  .object({
    text: z.string(),
    start: z.number().int(),
    end: z.number().int(),
    direction: z.enum(['given', 'received', 'unresolved']),
    terms: PstTermZ.nullable(),
  })
  .strict();
export const PstTransactionObservationZ = z
  .object({
    id: z.string(),
    pageId: z.string(),
    rowId: z.string(),
    cellId: z.string(),
    nodeId: z.string(),
    text: z.string(),
    transactionDate: z.string().nullable(),
    effectiveDate: z.null(),
    speakerTeam: z.string().nullable(),
    clauses: z.array(PstClauseZ),
    highlightedTexts: z.array(z.string()),
  })
  .strict();

export const PstLifecycleAssertionZ = z
  .object({
    id: z.string(),
    assetIds: z.array(z.string()).min(1),
    kind: z.enum([
      'assignment',
      'swap-interest',
      'pool-allocation',
      'snapshot',
    ]),
    transactionDate: z.string().nullable(),
    effectiveDate: z.null(),
    fromTeam: z.string().nullable(),
    toTeam: z.string().nullable(),
    status: z.enum(['conditional', 'reported', 'uncertain']),
    eventIdentity: z.enum([
      'exact-observation-equivalence',
      'dated-claim-with-source-variants',
      'undated-observation',
    ]),
    observations: z
      .array(
        z
          .object({
            rowId: z.string(),
            cellId: z.string(),
            narrativeId: z.string().nullable(),
            nodeId: z.string(),
            pageId: z.string(),
            targetTexts: z.array(z.string()),
            matching: z.string(),
            fromTeam: z.string().nullable(),
          })
          .strict()
      )
      .min(1),
    variants: z.array(z.object({ text: z.string(), terms: PstTermZ }).strict()),
    unresolved: z.array(z.string()),
  })
  .strict();

export const PstAssetHistoryZ = z
  .object({
    assetId: z.string(),
    rowIds: z.array(z.string()),
    assertionIds: z.array(z.string()),
    datedGroups: z.array(
      z
        .object({
          transactionDate: z.string(),
          assertionIds: z.array(z.string()),
        })
        .strict()
    ),
    undatedAssertionIds: z.array(z.string()),
    chronology: z.literal('partial-order-by-explicit-transaction-date'),
    outcomes: z.array(
      z
        .object({
          rowId: z.string(),
          outcome: PstObservedRowZ.shape.outcome.unwrap(),
        })
        .strict()
    ),
  })
  .strict();

export const PstReconstructionZ = z
  .object({
    transactions: z.array(PstTransactionObservationZ),
    assertions: z.array(PstLifecycleAssertionZ),
    histories: z.array(PstAssetHistoryZ),
    implementationConcerns: z.array(
      z.object({ evidence: z.string(), reason: z.string() }).strict()
    ),
  })
  .strict();

export type Clause = z.infer<typeof PstClauseZ>;
export type TransactionObservation = z.infer<typeof PstTransactionObservationZ>;
export type LifecycleAssertion = z.infer<typeof PstLifecycleAssertionZ>;
export type AssetHistory = z.infer<typeof PstAssetHistoryZ>;
