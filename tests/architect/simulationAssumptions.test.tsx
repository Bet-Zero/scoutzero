/** V1 item D4: every named SIMULATION assumption is listed and visible. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { simulationAssumptionsForWorld } from '@/features/architect/utils/simulationAssumptions';
import { SIMULATION_DRAFT_ASSUMPTIONS } from '@/features/architect/utils/simulationDraftBaseline';
import { SIMULATION_TRADE_DEADLINE_ASSUMPTION } from '@/features/architect/utils/governedSeason/simulationTradeDeadline';

const getDoc = vi.fn();
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  getDoc: (...args: unknown[]) => getDoc(...args),
}));
vi.mock('@/features/architect/utils/architectFirestorePaths', () => ({
  worldMetadataRef: (worldId: string) => ({
    path: `architect_worlds/${worldId}`,
  }),
}));

const { SimulationAssumptionsNotice } = await import(
  '@/features/architect/cockpit/SimulationAssumptionsNotice'
);

const MONEY = { simulationFinancialBaseline: { classification: 'SIMULATION' } };
const DRAFT = { draftBaseline: { classification: 'simulation' } };

afterEach(() => {
  cleanup();
  getDoc.mockReset();
});

describe('simulationAssumptionsForWorld', () => {
  it('lists nothing for a world that is not SIMULATION', () => {
    expect(simulationAssumptionsForWorld(null)).toEqual([]);
    expect(simulationAssumptionsForWorld({})).toEqual([]);
    expect(
      simulationAssumptionsForWorld({
        draftBaseline: { classification: 'software-fixture' },
      })
    ).toEqual([]);
  });

  it('lists money and trade assumptions for the SIMULATION money baseline', () => {
    const ids = simulationAssumptionsForWorld(MONEY).map((a) => a.id);
    expect(ids).toContain('unknown-bonuses-none');
    expect(ids).toContain('tax-salary-baseline');
    expect(ids).toContain('empty-cash-ledger');
    expect(ids).toContain(SIMULATION_TRADE_DEADLINE_ASSUMPTION.id);
    expect(ids).not.toContain('june5-reported-holder');
  });

  it('adds every draft assumption for a SIMULATION draft baseline, with unique ids', () => {
    const all = simulationAssumptionsForWorld({ ...MONEY, ...DRAFT });
    const ids = all.map((a) => a.id);
    for (const draft of SIMULATION_DRAFT_ASSUMPTIONS)
      expect(ids).toContain(draft.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of all) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.statement.length).toBeGreaterThan(20);
    }
  });
});

describe('SimulationAssumptionsNotice', () => {
  it('shows the count and opens the full list as visible text', async () => {
    getDoc.mockResolvedValue({ data: () => ({ ...MONEY, ...DRAFT }) });
    render(<SimulationAssumptionsNotice worldId="w1" />);
    const toggle = await screen.findByTestId('simulation-assumptions-toggle');
    const count = simulationAssumptionsForWorld({ ...MONEY, ...DRAFT }).length;
    expect(toggle).toHaveTextContent(`SIMULATION · ${count} named assumptions`);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByTestId('simulation-assumptions-list');
    expect(list).toHaveTextContent('Trade deadline.');
    expect(list).toHaveTextContent(
      SIMULATION_TRADE_DEADLINE_ASSUMPTION.statement
    );
    expect(list.querySelectorAll('[data-assumption-id]')).toHaveLength(count);
  });

  it('renders nothing for an ordinary world', async () => {
    getDoc.mockResolvedValue({ data: () => ({ worldName: 'Old world' }) });
    const { container } = render(<SimulationAssumptionsNotice worldId="w2" />);
    await vi.waitFor(() => expect(getDoc).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
