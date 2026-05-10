import React from 'react';

const SHOOTING_TIERS = {
  Elite: 'text-green-500 border-green-500',
  Plus: 'text-lime-400 border-lime-400',
  Capable: 'text-yellow-400 border-yellow-400',
  Willing: 'text-orange-400 border-orange-400',
  Hesitant: 'text-orange-600 border-orange-600',
  Non: 'text-red-600 border-red-600',
} as const;

type ShootingProfileMiniProps = {
  value?: string | null;
  compact?: boolean;
};

export const ShootingProfileMini = ({
  value = '',
  compact = false,
}: ShootingProfileMiniProps) => {
  const cleaned = value?.replace('Shooter', '').trim();
  const label = cleaned || '—';
  const isEmpty = label === '—';

  const style = isEmpty
    ? 'text-white/30 border-white/20'
    : SHOOTING_TIERS[cleaned as keyof typeof SHOOTING_TIERS] ||
      'text-white border-white';

  // Phase 2L: compact mode for tighter row density
  const sizeClasses = compact
    ? 'w-[55px] py-0.5 text-[10px]'
    : 'w-[70px] py-1 text-xs';
  const labelClasses = compact
    ? 'absolute -top-3 text-[8px]'
    : 'absolute -top-4 text-[9px]';

  return (
    <div className="relative flex items-center justify-center">
      {/* Badge */}
      <div
        className={`${sizeClasses} rounded-md border font-medium text-center tracking-wide ${style}`}
      >
        {label.toUpperCase()}
      </div>

      {/* Floating Label */}
      <span className={`${labelClasses} text-gray-400 uppercase tracking-wide`}>
        Shooting
      </span>
    </div>
  );
};

