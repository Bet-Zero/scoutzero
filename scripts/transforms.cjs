module.exports = {
  transforms: {
    copy: (v) => v,
    toNumber: (v) => (v === '' || v == null ? null : Number(v)),
    toString: (v) => (v == null ? null : String(v)),
    copyArray: (v) => (Array.isArray(v) ? v : v == null ? [] : [v]),
    percentToFloat: (v) =>
      v == null ? null : Number(String(v).replace('%', '')) / 100,
    slugifyId: (name) =>
      !name
        ? null
        : String(name)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, ''),
    feetInchesToInches: (s) => {
      if (!s) return null;
      const m = String(s).match(/(\d+)[^\d]+(\d+)/);
      if (!m) return null;
      return Number(m[1]) * 12 + Number(m[2]);
    },
    deriveYearsLeft: (years) => {
      if (!Array.isArray(years)) return 0;
      const now = new Date();
      // Since we're in October 2025, the current season is 2025-26
      // We want years remaining AFTER the current season
      const currentYear =
        now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;

      // Count salary years that are AFTER the current year
      return years.filter((x) => x && x.year && Number(x.year) > currentYear)
        .length;
    },
    deriveStartSeason: (years) =>
      Array.isArray(years) && years.length
        ? String(years.map((y) => y.season || y.year).sort()[0])
        : null,
    deriveEndSeason: (years) =>
      Array.isArray(years) && years.length
        ? String(
            years
              .map((y) => y.season || y.year)
              .sort()
              .slice(-1)[0]
          )
        : null,
    deriveSeasonSalary: (years, ctx) => {
      if (!Array.isArray(years)) return null;
      const s =
        (ctx && ctx.placeholders && ctx.placeholders.seasonId) || '2025-26';
      // Extract the starting year from season string (e.g., "2025-26" -> 2025)
      const targetYear = parseInt(s.split('-')[0]);
      const row = years.find((y) => y && Number(y.year) === targetYear);
      return row ? row.salary : null;
    },
    deriveWinningContractId: (_obj, ctx) =>
      ctx && ctx.placeholders ? ctx.placeholders.contractId : null,
    toShootingEnum: (v) => {
      if (v == null) return null;
      const ok = ['Elite', 'Plus', 'Capable', 'Willing', 'Hesitant', 'Non'];
      return ok.includes(v) ? v : null;
    },
  },
};
