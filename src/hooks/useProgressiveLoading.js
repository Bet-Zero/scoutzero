/**
 * Progressive Loading Hook
 * Add this to your existing PlayerTable component for better performance
 */

import { useState, useEffect } from 'react';

/**
 * Hook to gradually load more items as user scrolls
 * @param {Array} items - All items to display
 * @param {number} initialCount - Number of items to show initially
 * @param {number} increment - How many items to add when loading more
 */
export const useProgressiveLoading = (items = [], initialCount = 50, increment = 50) => {
  const [visibleCount, setVisibleCount] = useState(initialCount);

  // Reset visible count when items change (new filter/search)
  useEffect(() => {
    setVisibleCount(initialCount);
  }, [items.length, initialCount]);

  // Add scroll listener for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;
      
      // Load more when user is 1000px from bottom
      if (scrollTop + clientHeight >= scrollHeight - 1000) {
        setVisibleCount(prev => Math.min(prev + increment, items.length));
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [increment, items.length]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return { 
    visibleItems, 
    hasMore, 
    visibleCount,
    totalCount: items.length
  };
};

/**
 * Loading indicator component
 */
export const ProgressiveLoadingIndicator = ({ hasMore, visibleCount, totalCount }) => {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center py-4 text-gray-500">
      <span>
        Showing {visibleCount} of {totalCount} players. 
        <span className="ml-2 text-xs">Scroll for more...</span>
      </span>
    </div>
  );
};