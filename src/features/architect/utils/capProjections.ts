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

const capProjections: Record<string, CapProjectionLike> = {
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
    cap: 165472000,
    floor: 148924800,
    tax: 201048000,
    firstApron: 209661000,
    secondApron: 222372000,
    bae: 5494000,
    roomMLE: 9396000,
    fullMLE: 15091000,
    taxpayerMLE: 6083000,
    // rookieMin removed (will be projected)
    growthRate: 0.07,
    confirmed: false,
  },
  '2027-28': {
    cap: 182019000,
    floor: 163817300,
    tax: 221153000,
    firstApron: 230627000,
    secondApron: 244609000,
    bae: 6043000,
    roomMLE: 10336000,
    fullMLE: 16600000,
    taxpayerMLE: 6691000,
    // rookieMin removed (will be projected)
    growthRate: 0.1,
    confirmed: false,
  },
  '2028-29': {
    cap: 200221000,
    floor: 180199000,
    tax: 243268000,
    firstApron: 253690000,
    secondApron: 269070000,
    bae: 6647000,
    roomMLE: 11370000,
    fullMLE: 18260000,
    taxpayerMLE: 7360000,
    // rookieMin removed (will be projected)
    growthRate: 0.1,
    confirmed: false,
  },
  '2029-30': {
    cap: 220243000,
    floor: 198218900,
    tax: 267595000,
    firstApron: 279059000,
    secondApron: 295977000,
    bae: 7312000,
    roomMLE: 12507000,
    fullMLE: 20086000,
    taxpayerMLE: 8096000,
    // rookieMin removed (will be projected)
    growthRate: 0.1,
    confirmed: false,
  },
  '2030-31': {
    cap: 242267000,
    floor: 218040800,
    tax: 294355000,
    firstApron: 306965000,
    secondApron: 325575000,
    bae: 8043000,
    roomMLE: 13758000,
    fullMLE: 22095000,
    taxpayerMLE: 8906000,
    // rookieMin removed (will be projected)
    growthRate: 0.1,
    confirmed: false,
  },
  '2031-32': {
    cap: 266494000,
    floor: 239845000,
    tax: 323791000,
    firstApron: 337662000,
    secondApron: 358133000,
    bae: 8847000,
    roomMLE: 15134000,
    fullMLE: 24305000,
    taxpayerMLE: 9797000,
    // rookieMin removed (will be projected)
    growthRate: 0.1,
    confirmed: false,
  },
};

export default capProjections;
