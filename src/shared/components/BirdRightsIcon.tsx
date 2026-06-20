/**
 * FILE: src/shared/components/BirdRightsIcon.tsx
 * PURPOSE: Display bird rights icons for NBA contract exceptions
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2025-12-11: Created component to display bird rights icons from public/assets/icons
 *
 * LINKS:
 *  - Icons: public/assets/icons/bird_*.svg
 *  - Used in: src/features/architect/CapSheetFull.jsx
 */

import React from 'react';

/**
 * BirdRightsIcon component displays the appropriate bird rights icon based on the type
 * @param {Object} props
 * @param {string} props.type - The bird rights type ('Early Bird', 'Full Bird', 'Non-Bird', 'None')
 * @param {string} props.className - Additional CSS classes
 * @param {number} props.size - Icon size in pixels (default: 16)
 * @param {'light'|'dark'} props.tone - Render tone. 'light' (default) recolors the
 *        black source SVG to white so the marker is visible on dark cockpit
 *        surfaces; 'dark' leaves the original black silhouette for light chips.
 */
type BirdRightsIconProps = {
  type?: string | null;
  className?: string;
  size?: number;
  tone?: 'light' | 'dark';
};

export const BirdRightsIcon = ({
  type,
  className = '',
  size = 16,
  tone = 'light',
}: BirdRightsIconProps) => {
  if (!type) return null;

  // Map bird rights types to icon filenames
  const iconMap: Partial<
    Record<'Early Bird' | 'Full Bird' | 'Non-Bird' | 'None', string>
  > = {
    'Early Bird': 'bird_early_bird.svg',
    'Full Bird': 'bird_full_bird.svg',
    'Non-Bird': 'bird_non_bird.svg',
  };

  const iconFile =
    type === 'Early Bird' ||
    type === 'Full Bird' ||
    type === 'Non-Bird' ||
    type === 'None'
      ? iconMap[type]
      : null;
  if (!iconFile) return null;

  // The source SVGs are solid black (#040404); on dark cockpit surfaces they
  // read as a blank box. `brightness(0) invert(1)` forces a crisp white
  // silhouette so the marker is visible in-cell and in the Key/legend.
  const toneFilter = tone === 'light' ? 'brightness(0) invert(1)' : undefined;

  return (
    <img
      src={`/assets/icons/${iconFile}`}
      alt={`${type} rights`}
      className={`inline-block ${className}`}
      style={{ width: size, height: size, filter: toneFilter }}
    />
  );
};

