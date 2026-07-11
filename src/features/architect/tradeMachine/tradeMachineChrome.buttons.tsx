import React from 'react';

/**
 * Shared button vocabulary for the Trade Machine chrome (header toolbar, panel
 * actions). One consistent shape/size/focus treatment so the surrounding UI
 * stops looking ad-hoc. Color *intent* is expressed via `tone`, not via five
 * unrelated one-off styles.
 *
 * Scope: Trade Machine chrome only. This is intentionally not an app-wide
 * Button — a generic shared Button is a larger refactor out of scope here.
 */

export type ButtonTone = 'default' | 'positive' | 'warning';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
};

type TonelessButtonProps = Omit<ButtonProps, 'tone'>;

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium ' +
  'px-3 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-white/30 disabled:cursor-not-allowed';

// Filled action buttons carry a status-toned fill. The cockpit status colors are
// light, so solid fills pair with near-black (`text-cockpit-void`) text for
// legible contrast; disabled collapses to a recessed slab so it reads disabled.
const PRIMARY_TONE: Record<ButtonTone, string> = {
  default:
    'bg-cockpit-info hover:bg-cockpit-info/90 text-cockpit-void disabled:bg-cockpit-raised disabled:text-cockpit-text-ghost',
  positive:
    'bg-cockpit-safe hover:bg-cockpit-safe/90 text-cockpit-void disabled:bg-cockpit-raised disabled:text-cockpit-text-ghost',
  warning:
    'bg-cockpit-watch hover:bg-cockpit-watch/90 text-cockpit-void disabled:bg-cockpit-raised disabled:text-cockpit-text-ghost',
};

const SUBTLE_TONE: Record<ButtonTone, string> = {
  default:
    'bg-cockpit-raised hover:bg-cockpit-edge text-cockpit-text-secondary hover:text-cockpit-text-primary',
  positive: 'bg-cockpit-safe/15 hover:bg-cockpit-safe/25 text-cockpit-safe',
  warning: 'bg-cockpit-watch/15 hover:bg-cockpit-watch/25 text-cockpit-watch',
};

const SECONDARY =
  'bg-cockpit-raised hover:bg-cockpit-edge text-cockpit-text-primary ' +
  'disabled:bg-cockpit-slab disabled:text-cockpit-text-muted';

const ICON =
  'inline-flex items-center justify-center rounded-md p-1.5 text-cockpit-text-secondary ' +
  'hover:text-cockpit-text-primary hover:bg-cockpit-raised transition-colors focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed ' +
  'disabled:text-cockpit-text-ghost';

/** Main affirmative action — Validate, Apply. Use `tone="positive"` for Apply. */
export const PrimaryButton = ({
  tone = 'default',
  className = '',
  ...props
}: ButtonProps) => (
  <button {...props} className={`${BASE} ${PRIMARY_TONE[tone]} ${className}`} />
);

/** Neutral secondary action — Add Team. */
export const SecondaryButton = ({
  className = '',
  ...props
}: TonelessButtonProps) => (
  <button {...props} className={`${BASE} ${SECONDARY} ${className}`} />
);

/** Low-emphasis action — session / utility buttons. */
export const SubtleButton = ({
  tone = 'default',
  className = '',
  ...props
}: ButtonProps) => (
  <button {...props} className={`${BASE} ${SUBTLE_TONE[tone]} ${className}`} />
);

/** Icon-only action — Reset. Pass the lucide icon as children. */
export const IconButton = ({ className = '', ...props }: TonelessButtonProps) => (
  <button {...props} className={`${ICON} ${className}`} />
);
