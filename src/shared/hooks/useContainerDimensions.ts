/**
 * FILE: src/shared/hooks/useContainerDimensions.ts
 * PURPOSE: ResizeObserver-based hook to track container dimensions reliably.
 *          Replaces AutoSizer for react-window virtualization to avoid 0-height race conditions.
 *
 * OWNERSHIP: Feature: table/virtualization
 *
 * HISTORY:
 *  - 2026-01-28: Created to fix AutoSizer 0-height intermittent blank render issue
 *
 * LINKS:
 *  - Return Package: docs/return_packages/scouting/SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_MEASUREMENT_RP.md
 */

import { useState, useEffect, useRef, RefObject } from 'react';

export interface ContainerDimensions {
  width: number;
  height: number;
  ready: boolean;
}

const DEFAULT_FALLBACK = { width: 1100, height: 600 };

/**
 * Hook that uses ResizeObserver to track container dimensions reliably.
 * Unlike AutoSizer, this won't return 0 dimensions during layout settling
 * because it waits for the first valid measurement before reporting "ready".
 *
 * @param ref - React ref to the container element
 * @param fallback - Fallback dimensions to use before measurement is available
 * @returns ContainerDimensions object with width, height, and ready flag
 */
export function useContainerDimensions(
  ref: RefObject<HTMLElement | null>,
  fallback: { width: number; height: number } = DEFAULT_FALLBACK
): ContainerDimensions {
  const [dimensions, setDimensions] = useState<ContainerDimensions>({
    width: fallback.width,
    height: fallback.height,
    ready: false,
  });

  // Track if we've received a valid measurement
  const hasValidMeasurement = useRef(false);
  // Track RAF frame ID for cleanup
  const rafIdRef = useRef<number | null>(null);
  // Force re-run effect when element becomes available
  const [elementReady, setElementReady] = useState(false);

  // Memoize fallback values to avoid effect re-runs
  const fallbackWidth = fallback.width;
  const fallbackHeight = fallback.height;

  // Check if element is available on first render, schedule re-check if not
  useEffect(() => {
    if (ref.current && !elementReady) {
      setElementReady(true);
    } else if (!ref.current) {
      // Element not ready yet, schedule a check after next paint
      const checkId = requestAnimationFrame(() => {
        if (ref.current) {
          setElementReady(true);
        }
      });
      return () => cancelAnimationFrame(checkId);
    }
  }, [ref.current, elementReady]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateDimensions = () => {
      const rect = element.getBoundingClientRect();
      const newWidth = rect.width;
      const newHeight = rect.height;

      // Only update if we have valid (non-zero) dimensions
      if (newWidth > 0 && newHeight > 0) {
        hasValidMeasurement.current = true;
        setDimensions((prev) => {
          // Avoid redundant state updates
          if (prev.width === newWidth && prev.height === newHeight && prev.ready) {
            return prev;
          }
          return {
            width: newWidth,
            height: newHeight,
            ready: true,
          };
        });
      } else if (!hasValidMeasurement.current) {
        // If we haven't gotten a valid measurement yet, keep using fallback
        // but mark as not ready
        setDimensions((prev) => {
          if (prev.width === fallbackWidth && prev.height === fallbackHeight && !prev.ready) {
            return prev;
          }
          return {
            width: fallbackWidth,
            height: fallbackHeight,
            ready: false,
          };
        });
      }
      // If we had a valid measurement but now get 0 (shouldn't happen normally),
      // keep the last valid dimensions
    };

    // Initial measurement
    updateDimensions();

    // Set up ResizeObserver for ongoing updates
    const resizeObserver = new ResizeObserver(() => {
      // Cancel any pending RAF before scheduling a new one
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      // Use requestAnimationFrame to batch multiple resize events
      rafIdRef.current = requestAnimationFrame(updateDimensions);
    });

    resizeObserver.observe(element);

    return () => {
      // Cancel any pending RAF on cleanup
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      resizeObserver.disconnect();
    };
  }, [fallbackWidth, fallbackHeight, elementReady]);

  return dimensions;
}

