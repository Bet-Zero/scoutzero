import { formatHeight } from '@/utils/formatting';

export function getFilterDisplayValue(key, value) {
  const statAbbreviations = {
    PPG: 'ppg',
    RPG: 'rpg',
    APG: 'apg',
    FGP: 'fg%',
    TPP: '3p%',
    FTP: 'ft%',
    eFGP: 'efg%',
    MIN: 'min',
    G: 'games',
    Defense: 'def',
    Energy: 'energy',
    Feel: 'feel',
    IQ: 'iq',
    Passing: 'pass',
    Playmaking: 'play',
    Rebounding: 'reb',
    Shooting: 'shot',
  };

  if (key.startsWith('min_') || key.startsWith('max_')) {
    const statKey = key.split('_')[1];
    const abbreviation = statAbbreviations[statKey] || '';
    const symbol = key.startsWith('min_') ? '≥ ' : '≤ ';
    if (['FGP', 'TPP', 'FTP', 'eFGP'].includes(statKey)) {
      return `${symbol}${value}% ${abbreviation}`;
    }
    return `${symbol}${value} ${abbreviation}`;
  }

  if (key === 'minHeight') {
    return value !== null && value !== undefined
      ? `≥ ${formatHeight(value)}`
      : '';
  }
  if (key === 'maxHeight') {
    return value !== null && value !== undefined
      ? `≤ ${formatHeight(value)}`
      : '';
  }

  if (key === 'minWeight') {
    return value !== null && value !== undefined ? `≥ ${value} lbs` : '';
  }
  if (key === 'maxWeight') {
    return value !== null && value !== undefined ? `≤ ${value} lbs` : '';
  }

  if (key === 'minAge') {
    return value !== null && value !== undefined ? `≥ ${value} y/o` : '';
  }
  if (key === 'maxAge') {
    return value !== null && value !== undefined ? `≤ ${value} y/o` : '';
  }

  if (Array.isArray(value) && value.length > 0) {
    return value.join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    if (value.min !== undefined && value.max !== undefined) {
      return `${value.min} - ${value.max}`;
    }
    if (key === 'subRoles') {
      return [...(value.offense || []), ...(value.defense || [])].join(', ');
    }
  }
  if (value !== '' && value !== null && value !== undefined) {
    return String(value);
  }
  return null;
}

export function getFilterStyles(key, value) {
  const defaultStyles = {
    bgClass: 'bg-[#2a2a2a]',
    borderClass: 'border-white/20',
    textClass: 'text-white',
  };

  if (key.toLowerCase().includes('offense') || key === 'offenseRole') {
    return {
      bgClass: 'bg-purple-900/40',
      borderClass: 'border-purple-500',
      textClass: 'text-white/80',
    };
  }
  if (key.toLowerCase().includes('defense') || key === 'defenseRole') {
    return {
      bgClass: 'bg-blue-900/40',
      borderClass: 'border-blue-500',
      textClass: 'text-white/80',
    };
  }

  if (key.toLowerCase().includes('shooting')) {
    const shootingTiers = {
      Elite: { borderClass: 'border-green-500', textClass: 'text-green-500' },
      Plus: { borderClass: 'border-lime-400', textClass: 'text-lime-400' },
      Capable: {
        borderClass: 'border-yellow-400',
        textClass: 'text-yellow-400',
      },
      Willing: {
        borderClass: 'border-orange-400',
        textClass: 'text-orange-400',
      },
      Hesitant: {
        borderClass: 'border-orange-600',
        textClass: 'text-orange-600',
      },
      Non: { borderClass: 'border-red-600', textClass: 'text-red-600' },
    };
    const cleaned = String(value).replace('Shooter', '').trim();
    return shootingTiers[cleaned] || defaultStyles;
  }

  if (
    key.toLowerCase().includes('grade') ||
    key.toLowerCase().includes('overall')
  ) {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      if (numValue >= 98)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-green-600',
          textClass: 'text-green-600',
        };
      if (numValue >= 94)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-green-500',
          textClass: 'text-green-500',
        };
      if (numValue >= 91)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-green-400',
          textClass: 'text-green-400',
        };
      if (numValue >= 86)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-emerald-400',
          textClass: 'text-emerald-400',
        };
      if (numValue >= 80)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-emerald-300',
          textClass: 'text-emerald-300',
        };
      if (numValue >= 73)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-teal-200',
          textClass: 'text-teal-200',
        };
      if (numValue >= 66)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-gray-300',
          textClass: 'text-gray-300',
        };
      if (numValue >= 56)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-red-200',
          textClass: 'text-red-200',
        };
      if (numValue >= 46)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-red-300',
          textClass: 'text-red-300',
        };
      if (numValue >= 41)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-red-400',
          textClass: 'text-red-400',
        };
      if (numValue >= 36)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-red-500',
          textClass: 'text-red-500',
        };
      if (numValue >= 26)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-red-600',
          textClass: 'text-red-600',
        };
      if (numValue >= 16)
        return {
          bgClass: 'bg-[#2a2a2a]',
          borderClass: 'border-red-700',
          textClass: 'text-red-700',
        };
    }
  }

  if (key.startsWith('min_') || key.startsWith('max_')) {
    const statKey = key.split('_')[1];
    if (
      [
        'Defense',
        'Energy',
        'Feel',
        'IQ',
        'Passing',
        'Playmaking',
        'Rebounding',
        'Shooting',
      ].includes(statKey)
    ) {
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        if (numValue >= 98)
          return {
            borderClass: 'border-green-600',
            textClass: 'text-green-600',
          };
        if (numValue >= 94)
          return {
            borderClass: 'border-green-500',
            textClass: 'text-green-500',
          };
        if (numValue >= 91)
          return {
            borderClass: 'border-green-400',
            textClass: 'text-green-400',
          };
        if (numValue >= 86)
          return {
            borderClass: 'border-emerald-400',
            textClass: 'text-emerald-400',
          };
        if (numValue >= 80)
          return {
            borderClass: 'border-emerald-300',
            textClass: 'text-emerald-300',
          };
        if (numValue >= 73)
          return { borderClass: 'border-teal-200', textClass: 'text-teal-200' };
        if (numValue >= 66)
          return { borderClass: 'border-gray-300', textClass: 'text-gray-300' };
        if (numValue >= 56)
          return { borderClass: 'border-red-200', textClass: 'text-red-200' };
        if (numValue >= 46)
          return { borderClass: 'border-red-300', textClass: 'text-red-300' };
        if (numValue >= 41)
          return { borderClass: 'border-red-400', textClass: 'text-red-400' };
        if (numValue >= 36)
          return { borderClass: 'border-red-500', textClass: 'text-red-500' };
        if (numValue >= 26)
          return { borderClass: 'border-red-600', textClass: 'text-red-600' };
        if (numValue >= 16)
          return { borderClass: 'border-red-700', textClass: 'text-red-700' };
      }
    }
  }

  if (key.toLowerCase().includes('option')) {
    const valueStr = String(value).toLowerCase();
    if (valueStr.includes('player')) {
      return {
        bgClass: 'bg-green-900/40',
        borderClass: 'border-green-500',
        textClass: 'text-green-500',
      };
    }
    if (valueStr.includes('team')) {
      return {
        bgClass: 'bg-orange-900/40',
        borderClass: 'border-orange-400',
        textClass: 'text-orange-400',
      };
    }
  }

  if (
    key.toLowerCase().includes('status') ||
    key.toLowerCase().includes('fa')
  ) {
    const valueStr = String(value).toLowerCase();
    if (valueStr.includes('ufa')) {
      return {
        bgClass: 'bg-blue-600/40',
        borderClass: 'border-blue-600',
        textClass: 'text-blue-400',
      };
    }
    if (valueStr.includes('rfa')) {
      return {
        bgClass: 'bg-purple-600/40',
        borderClass: 'border-purple-600',
        textClass: 'text-purple-400',
      };
    }
  }

  return defaultStyles;
}
