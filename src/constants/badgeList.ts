export const BadgeList = [
  { key: 'sniper', label: 'Sniper', icon: '🎯' },
  { key: 'dimes', label: 'Dimes', icon: '🪙' },
  { key: 'bucket', label: 'Bucket', icon: '🪣' },
  { key: 'handles', label: 'Handles', icon: '🏀' },
  { key: 'board_man', label: 'Board Man', icon: '📦' },
  { key: 'high_flyer', label: 'High Flyer', icon: '🚀' },
  { key: 'bully', label: 'Bully', icon: '💪' },
  { key: 'speed', label: 'Speed', icon: '⚡️' },
  { key: 'floor_general', label: 'Floor General', icon: '🗺️' },
  { key: 'clutch', label: 'Clutch', icon: '🥶' },
  { key: 'high_motor', label: 'High Motor', icon: '🔋' },
  { key: 'high_iq', label: 'High IQ', icon: '🧠' },
  { key: 'coachs_dream', label: "Coach's Dream", icon: '🧩' },
  { key: 'versatile', label: 'Versatile', icon: '🎭' },
  { key: 'chess_piece', label: 'Chess Piece', icon: '♟️' },
  { key: 'dog', label: 'Dog', icon: '🐾' },
  { key: 'leader', label: 'Leader', icon: '🗣️' },
  { key: 'lockdown_defender', label: 'Lockdown Defender', icon: '🔒' },
  { key: 'glue_guy', label: 'Glue Guy', icon: '⚙️' },
  { key: 'disruptor', label: 'Disruptor', icon: '🚨' },
  { key: 'mismatch_nightmare', label: 'Mismatch Nightmare', icon: '😈' },
  { key: 'iron_man', label: 'Iron Man', icon: '🦾' },
  { key: 'cool_under_pressure', label: 'Cool Under Pressure', icon: '🧊' },
  { key: 'veteran_presence', label: 'Veteran Presence', icon: '🦉' },
] as const;

export type Badge = (typeof BadgeList)[number];
export type BadgeKey = Badge['key'];
