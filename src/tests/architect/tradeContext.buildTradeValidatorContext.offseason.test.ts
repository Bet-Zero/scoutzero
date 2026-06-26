import { describe, expect, it } from 'vitest';
import { buildTradeValidatorContext } from '@/features/architect/utils/tradeContext/tradeContext.payloadNormalization';
import type { TradeContextPayload } from '@/features/architect/utils/tradeContext/types';

function makePayload(overrides: Partial<TradeContextPayload> = {}): TradeContextPayload {
  return {
    teams: [],
    ...overrides,
  };
}

describe('buildTradeValidatorContext: offseason derivation', () => {
  it('derives offseason=true from an offseason asOfDate (July)', () => {
    const ctx = buildTradeValidatorContext(
      makePayload({ tradeCtx: { asOfDate: '2026-07-10', source: 'tradeMachine' } })
    );
    expect(ctx.offseason).toBe(true);
  });

  it('derives offseason=false from a regular-season asOfDate (February)', () => {
    const ctx = buildTradeValidatorContext(
      makePayload({ tradeCtx: { asOfDate: '2026-02-15', source: 'tradeMachine' } })
    );
    expect(ctx.offseason).toBe(false);
  });

  it('explicit offseason=true wins even when asOfDate is regular-season', () => {
    const ctx = buildTradeValidatorContext(
      makePayload({ tradeCtx: { asOfDate: '2026-02-15', offseason: true, source: 'tradeMachine' } })
    );
    expect(ctx.offseason).toBe(true);
  });

  it('explicit offseason=false wins even when asOfDate is offseason', () => {
    const ctx = buildTradeValidatorContext(
      makePayload({ tradeCtx: { asOfDate: '2026-07-10', offseason: false, source: 'tradeMachine' } })
    );
    expect(ctx.offseason).toBe(false);
  });

  it('leaves offseason undefined when no asOfDate is present', () => {
    const ctx = buildTradeValidatorContext(makePayload({ tradeCtx: { source: 'tradeMachine' } }));
    expect(ctx.offseason).toBeUndefined();
  });
});
