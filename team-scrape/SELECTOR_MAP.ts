// SELECTOR_MAP.ts — tuned for SalarySwish team pages
// URL example: https://www.salaryswish.com/teams/lakers

export const SELECTOR_MAP = {
  team: {
    // H1 shows the team name (e.g., "LOS ANGELES LAKERS")
    // We'll derive teamCode ("LAL") from the URL later.
    name: 'h1',
    code: null, // leave null; derive from URL path (/teams/lakers → LAL)
    season: null, // page shows a "Season Display" heading but we set season externally
  },

  // Roster table follows the “Season Display”/columns area.
  // We anchor on any table whose THEAD contains "Active (".
  roster: {
    rows: "table:has(thead:contains('Active (')) tbody tr",
    name: 'td:nth-child(1) a',
    profileUrl: 'td:nth-child(1) a',
  },

  // SalarySwish team pages typically don't list Dead Cap/Cap Holds explicitly.
  // Keep these defined but expect 0 rows (that's OK).
  deadCap: {
    rows: "table:has(caption:contains('Dead Cap')) tbody tr",
    name: 'td:nth-child(1)',
    season: 'td:nth-child(2)',
    amount: 'td:nth-child(3)',
  },

  capHolds: {
    rows: "table:has(caption:contains('Cap Holds')) tbody tr",
    name: 'td:nth-child(1)',
    type: 'td:nth-child(2)',
    rights: 'td:nth-child(3)',
    amount: 'td:nth-child(4)',
  },

  // Exceptions
  exceptions: {
    // “SIGNING EXCEPTIONS” is a heading; the list items right after it contain the data.
    signingListItems: "h3:contains('SIGNING EXCEPTIONS') + ul li",

    // “TRADE EXCEPTIONS” is a heading; the table right after it contains rows.
    tpeRows: "h3:contains('TRADE EXCEPTIONS') + table tbody tr",
    tpePlayer: 'td:nth-child(1) a',
    tpeException: 'td:nth-child(2)',
    tpeUsed: 'td:nth-child(3)',
    tpeRemaining: 'td:nth-child(4)',
    tpeStart: 'td:nth-child(5)',
    tpeEnd: 'td:nth-child(6)',
  },

  // Draft picks is a grid of logos/years; we’ll handle parsing later.
  // For now we just locate the table after the “Draft” heading (rows count only).
  draftPicks: {
    rows: "h3:contains('Draft') + table tbody tr",
    yearHeaderCells: "h3:contains('Draft') + table thead th",
  },

  // Totals are rendered as <h5> headings at the top of the page.
  totals: {
    capHit: "h5:contains('CAP HIT')",
    capRoom: "h5:contains('CAP ROOM')",
    teamSalary: "h5:contains('TEAM SALARY ')", // note space to avoid ROOM
    teamSalaryRoom: "h5:contains('TEAM SALARY ROOM')",
    luxuryTaxRoom: "h5:contains('LUXURY TAX ROOM')",
    firstApronRoom: "h5:contains('1ST APRON ROOM')",
    secondApronRoom: "h5:contains('2ND APRON ROOM')",
    hardCapped: "h5:contains('HARD CAPPED')",
  },
} as const;
