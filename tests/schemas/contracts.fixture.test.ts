import { describe, it, expect } from 'vitest';
import sample from '../../player-scrape/shared/schema/sample_players_v2_format.json';
import { ContractDocZ } from '../../src/schemas/players_v2';

describe('Contract schema fixtures', () => {
  it('validates transformed contract fixture from scraper', () => {
    const contract = sample.data;
    const res = ContractDocZ.safeParse(contract);
    expect(res.success).toBe(true);
  });
});


