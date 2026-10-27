import { useEffect, useState } from 'react';

const getMatches = (query: string) =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(query).matches;

/**
 * Tracks whether a CSS media query matches. Returns false where matchMedia is
 * unavailable (tests, SSR), so callers fall back to their desktop layout.
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => getMatches(query));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);
    handleChange();
    // iOS < 14 Safari only has the deprecated addListener/removeListener.
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [query]);

  return matches;
};

/** Below Tailwind's `md` breakpoint. */
export const PHONE_MEDIA_QUERY = '(max-width: 767px)';
