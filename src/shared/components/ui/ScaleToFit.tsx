/**
 * Purpose: Shrinks fixed-width content (roster boards, the tier pyramid) to fit narrow screens.
 * Inputs: children laid out at their natural width; optional className for the outer box.
 * Outputs: Children rendered unscaled when they fit, otherwise CSS-scaled down to the
 *          available width with the outer box resized to the scaled height.
 * Risks: Scaled text gets small on very narrow screens; content must have an intrinsic width.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ScaleToFitProps = {
  children: ReactNode;
  className?: string;
};

export const ScaleToFit = ({ children, className = '' }: ScaleToFitProps) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const update = () => {
      // offsetWidth/offsetHeight ignore transforms, so they report the natural size.
      const available = outer.clientWidth;
      const natural = inner.offsetWidth;
      const next = available > 0 && natural > available ? available / natural : 1;
      setScale(next);
      setScaledHeight(next < 1 ? inner.offsetHeight * next : undefined);
    };

    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const scaled = scale < 1;

  return (
    <div
      ref={outerRef}
      className={`w-full ${className}`}
      style={scaled ? { height: scaledHeight, overflow: 'hidden' } : undefined}
    >
      <div
        ref={innerRef}
        className={scaled ? 'flow-root w-max' : 'flow-root w-max mx-auto'}
        style={
          scaled
            ? { transform: `scale(${scale})`, transformOrigin: 'top left' }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
};
