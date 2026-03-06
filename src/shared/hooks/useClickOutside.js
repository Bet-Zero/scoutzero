import { useEffect } from 'react';

/**
 * Calls the handler when a click occurs outside the element referenced by ref.
 * @param {React.RefObject} ref - Ref to the element to detect outside clicks for
 * @param {Function} handler - Callback when an outside click is detected
 * @param {boolean} [enabled=true] - Whether the listener is active
 */
const useClickOutside = (ref, handler, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleMouseDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [ref, handler, enabled]);
};

export default useClickOutside;
