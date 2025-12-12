/**
 * FILE: src/shared/components/BirdRightsIcon.jsx
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
 */
const BirdRightsIcon = ({ type, className = '', size = 16 }) => {
  if (!type) return null;

  // Map bird rights types to icon filenames
  const iconMap = {
    'Early Bird': 'bird_early_bird.svg',
    'Full Bird': 'bird_full_bird.svg',
    'Non-Bird': 'bird_non_bird.svg',
    None: null, // No icon for None
  };

  const iconFile = iconMap[type];
  if (!iconFile) return null;

  return (
    <img
      src={`/assets/icons/${iconFile}`}
      alt={`${type} rights`}
      className={`inline-block ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export default BirdRightsIcon;
