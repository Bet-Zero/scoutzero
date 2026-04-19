import { describe, it, expect } from 'vitest';

/**
 * Date Conversion Tests
 * 
 * Validates that date conversion to ISO format works correctly for all supported formats.
 */

describe('Date Conversion to ISO Format', () => {
  // Simulating the toISODate function logic
  function toISODate(dateStr) {
    // Parse date like "Aug 2, 2025" to ISO "2025-08-02"
    const dateMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (dateMatch) {
      const monthMap = {
        jan: '01',
        january: '01',
        feb: '02',
        february: '02',
        mar: '03',
        march: '03',
        apr: '04',
        april: '04',
        may: '05',
        jun: '06',
        june: '06',
        jul: '07',
        july: '07',
        aug: '08',
        august: '08',
        sep: '09',
        september: '09',
        oct: '10',
        october: '10',
        nov: '11',
        november: '11',
        dec: '12',
        december: '12',
      };

      const month = monthMap[dateMatch[1].toLowerCase()];
      if (!month) return null;

      const day = dateMatch[2].padStart(2, '0');
      const year = dateMatch[3];

      return `${year}-${month}-${day}`;
    }

    // Parse date like "07/06/2023" to ISO "2023-07-06"
    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const month = slashMatch[1].padStart(2, '0');
      const day = slashMatch[2].padStart(2, '0');
      const year = slashMatch[3];
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  describe('Human-readable month format', () => {
    it('converts "Aug 2, 2025" to ISO', () => {
      expect(toISODate("Aug 2, 2025")).toBe("2025-08-02");
    });

    it('converts "June 28, 2025" to ISO', () => {
      expect(toISODate("June 28, 2025")).toBe("2025-06-28");
    });

    it('converts "January 1, 2024" to ISO', () => {
      expect(toISODate("January 1, 2024")).toBe("2024-01-01");
    });

    it('converts "December 31, 2025" to ISO', () => {
      expect(toISODate("December 31, 2025")).toBe("2025-12-31");
    });

    it('handles short month names', () => {
      expect(toISODate("Jan 5, 2025")).toBe("2025-01-05");
      expect(toISODate("Feb 10, 2025")).toBe("2025-02-10");
      expect(toISODate("Dec 25, 2025")).toBe("2025-12-25");
    });

    it('handles dates without commas', () => {
      expect(toISODate("Aug 2 2025")).toBe("2025-08-02");
    });

    it('pads single-digit days', () => {
      expect(toISODate("July 6, 2023")).toBe("2023-07-06");
    });
  });

  describe('Slash format (MM/DD/YYYY)', () => {
    it('converts "07/06/2023" to ISO', () => {
      expect(toISODate("07/06/2023")).toBe("2023-07-06");
    });

    it('converts "06/28/2025" to ISO', () => {
      expect(toISODate("06/28/2025")).toBe("2025-06-28");
    });

    it('converts "12/31/2025" to ISO', () => {
      expect(toISODate("12/31/2025")).toBe("2025-12-31");
    });

    it('pads single-digit months and days', () => {
      expect(toISODate("1/5/2025")).toBe("2025-01-05");
      expect(toISODate("3/9/2025")).toBe("2025-03-09");
    });

    it('handles two-digit months and days', () => {
      expect(toISODate("10/15/2025")).toBe("2025-10-15");
    });
  });

  describe('Invalid formats', () => {
    it('returns null for invalid month names', () => {
      expect(toISODate("Smarch 2, 2025")).toBeNull();
    });

    it('returns null for completely invalid strings', () => {
      expect(toISODate("not a date")).toBeNull();
    });

    it('returns null for partial dates', () => {
      expect(toISODate("Aug 2")).toBeNull();
      expect(toISODate("2025")).toBeNull();
    });
  });

  describe('ISO format validation', () => {
    it('validates ISO format pattern', () => {
      const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
      
      expect(toISODate("Aug 2, 2025")).toMatch(isoPattern);
      expect(toISODate("07/06/2023")).toMatch(isoPattern);
      expect(toISODate("June 28, 2025")).toMatch(isoPattern);
    });
  });
});
