// multiYearCapSettings.js
// ⚠️ DEPRECATED ⚠️
// Do not import directly from feature code. Use @/features/architect/utils/capRulesProfile instead.

type CapProjectionLike = {
  cap: number;
  floor: number;
  tax: number;
  firstApron: number;
  secondApron: number;
  bae: number;
  roomMLE: number;
  fullMLE: number;
  taxpayerMLE: number;
  rookieMin?: number;
  rookieMinSource?: string;
  growthRate: number;
  confirmed: boolean;
};

export const capProjections: Record<string, CapProjectionLike> = {
  '2024-25': {
    cap: 141000000, // $141 million
    floor: 127000000, // 90% of cap
    tax: 171000000, // ~$171 million
    firstApron: 179000000, // ~$179 million
    secondApron: 190000000, // ~$190 million (estimated)
    bae: 4700000, // $4.7 million
    roomMLE: 8000000, // $8 million
    fullMLE: 12900000, // $12.9 million
    taxpayerMLE: 5000000, // $5 million
    rookieMin: 1119563, // from CBA_THRESHOLDS
    rookieMinSource: 'real',
    growthRate: 0.1, // 10% increase from 2023-24
    confirmed: true, // These are final numbers
  },
  '2025-26': {
    cap: 154647000,
    floor: 139182100,
    tax: 187895000,
    firstApron: 195945000,
    secondApron: 207824000,
    bae: 5135000,
    roomMLE: 8781000,
    fullMLE: 14104000,
    taxpayerMLE: 5685000,
    rookieMin: 1164345, // ~4% growth
    rookieMinSource: 'real',
    growthRate: 0.1,
    confirmed: true,
  },
  '2026-27': {
    // Official NBA numbers, set June 30 2026 (effective July 1)
    cap: 164961000,
    floor: 148465000, // minimum team salary
    tax: 200428000,
    firstApron: 209015000,
    secondApron: 221686000,
    bae: 5477000,
    roomMLE: 9366000,
    fullMLE: 15044000,
    taxpayerMLE: 6064000,
    // rookieMin removed (will be projected)
    growthRate: 0.0667, // actual increase from 2025-26
    confirmed: true,
  },
  // 2027-28 onward: projections compounded from the official 2026-27 base at
  // the NBA's guided ~5.5% growth (July 2026 guidance: 2027-28 cap ~$174M).
  // Floor is held at exactly 90% of cap, matching the official 2026-27 ratio.
  '2027-28': {
    cap: 174034000,
    floor: 156631000,
    tax: 211452000,
    firstApron: 220511000,
    secondApron: 233879000,
    bae: 5778000,
    roomMLE: 9881000,
    fullMLE: 15871000,
    taxpayerMLE: 6398000,
    // rookieMin removed (will be projected)
    growthRate: 0.055,
    confirmed: false,
  },
  '2028-29': {
    cap: 183606000,
    floor: 165245000,
    tax: 223081000,
    firstApron: 232639000,
    secondApron: 246742000,
    bae: 6096000,
    roomMLE: 10425000,
    fullMLE: 16744000,
    taxpayerMLE: 6749000,
    // rookieMin removed (will be projected)
    growthRate: 0.055,
    confirmed: false,
  },
  '2029-30': {
    cap: 193704000,
    floor: 174334000,
    tax: 235351000,
    firstApron: 245434000,
    secondApron: 260313000,
    bae: 6431000,
    roomMLE: 10998000,
    fullMLE: 17665000,
    taxpayerMLE: 7121000,
    // rookieMin removed (will be projected)
    growthRate: 0.055,
    confirmed: false,
  },
  '2030-31': {
    cap: 204358000,
    floor: 183922000,
    tax: 248295000,
    firstApron: 258933000,
    secondApron: 274630000,
    bae: 6785000,
    roomMLE: 11603000,
    fullMLE: 18637000,
    taxpayerMLE: 7512000,
    // rookieMin removed (will be projected)
    growthRate: 0.055,
    confirmed: false,
  },
  '2031-32': {
    cap: 215597000,
    floor: 194037000,
    tax: 261951000,
    firstApron: 273174000,
    secondApron: 289735000,
    bae: 7158000,
    roomMLE: 12241000,
    fullMLE: 19662000,
    taxpayerMLE: 7925000,
    // rookieMin removed (will be projected)
    growthRate: 0.055,
    confirmed: false,
  },
};

