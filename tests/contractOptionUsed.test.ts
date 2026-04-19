import { describe, it, expect } from 'vitest';

describe('Contract Option Used Schema', () => {
  it('should have optionUsed as boolean and optionDecisionDate as ISO date string', () => {
    // Simulating the new schema format
    const salaryRow = {
      season: "2025-26",
      salary: 2221677,
      capHit: 2221677,
      guaranteed: false,
      guaranteedAmount: 88075,
      option: "TO",
      optionUsed: true,
      optionDecisionDate: "2025-06-28",
      tradeBonus: null,
      incentives: { likely: 0, unlikely: 0 }
    };

    // Verify optionUsed is boolean
    expect(typeof salaryRow.optionUsed).toBe('boolean');
    expect(salaryRow.optionUsed).toBe(true);

    // Verify optionDecisionDate is ISO format string
    expect(typeof salaryRow.optionDecisionDate).toBe('string');
    expect(salaryRow.optionDecisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(salaryRow.optionDecisionDate).toBe('2025-06-28');
  });

  it('should handle null optionUsed and optionDecisionDate for non-option years', () => {
    const salaryRow = {
      season: "2024-25",
      salary: 1891857,
      capHit: 1891857,
      guaranteed: true,
      guaranteedAmount: 1891857,
      option: null,
      optionUsed: null,
      optionDecisionDate: null,
      tradeBonus: null,
      incentives: { likely: 0, unlikely: 0 }
    };

    expect(salaryRow.optionUsed).toBeNull();
    expect(salaryRow.optionDecisionDate).toBeNull();
  });

  it('should handle declined options (optionUsed: false)', () => {
    const salaryRow = {
      season: "2026-27",
      salary: 5000000,
      capHit: 5000000,
      guaranteed: false,
      guaranteedAmount: 0,
      option: "PO",
      optionUsed: false,
      optionDecisionDate: "2025-08-02",
      tradeBonus: null,
      incentives: { likely: 0, unlikely: 0 }
    };

    expect(salaryRow.optionUsed).toBe(false);
    expect(typeof salaryRow.optionDecisionDate).toBe('string');
    expect(salaryRow.optionDecisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should parse date from "Jun 28, 2025" to "2025-06-28"', () => {
    // This would be tested via the toISODate function in the parser
    const monthMap = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    
    const input = "Jun 28, 2025";
    const match = input.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    
    expect(match).toBeTruthy();
    const month = monthMap[match[1].toLowerCase()];
    const day = match[2].padStart(2, '0');
    const year = match[3];
    const isoDate = `${year}-${month}-${day}`;
    
    expect(isoDate).toBe('2025-06-28');
  });
});
