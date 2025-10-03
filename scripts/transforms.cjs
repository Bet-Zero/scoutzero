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
      const y = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
      const tag = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
      return years.filter((x) => x && x.season && String(x.season) >= tag).length;
    },
    deriveStartSeason: (years) =>
      Array.isArray(years) && years.length
        ? String(years.map((y) => y.season).sort()[0])
        : null,
    deriveEndSeason: (years) =>
      Array.isArray(years) && years.length
        ? String(
            years
              .map((y) => y.season)
              .sort()
              .slice(-1)[0]
          )
        : null,
    deriveSeasonSalary: (years, ctx) => {
      if (!Array.isArray(years)) return null;
      const s =
        (ctx && ctx.placeholders && ctx.placeholders.seasonId) || '2025-26';
      const row = years.find((y) => y && String(y.season) === s);
      return row ? row.salary : null;
    },
    deriveWinningContractId: (_obj, ctx) =>
      ctx && ctx.placeholders ? ctx.placeholders.contractId : null,
    toShootingEnum: (v) => {
      if (v == null) return null;
      const ok = ['Elite', 'Plus', 'Capable', 'Willing', 'Hesitant', 'Non'];
      return ok.includes(v) ? v : null;
    },
  }
};
