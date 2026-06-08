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
  'inline-flex items-center justify-center gap-1.5 rounded text-sm font-medium ' +
  'px-3 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-white/30 disabled:cursor-not-allowed';

const PRIMARY_TONE: Record<ButtonTone, string> = {
  default:
    'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600 disabled:text-gray-400',
  positive:
    'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600 disabled:text-gray-400',
  warning:
    'bg-amber-600 hover:bg-amber-700 text-white disabled:bg-gray-600 disabled:text-gray-400',
};

const SUBTLE_TONE: Record<ButtonTone, string> = {
  default: 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white',
  positive: 'bg-green-700/50 hover:bg-green-600/50 text-green-200',
  warning: 'bg-amber-700/60 hover:bg-amber-600/60 text-amber-200',
};

const SECONDARY =
  'bg-neutral-700 hover:bg-neutral-600 text-white ' +
  'disabled:bg-neutral-800 disabled:text-white/40';

const ICON =
  'inline-flex items-center justify-center rounded p-1.5 text-white/70 ' +
  'hover:text-white hover:bg-white/5 transition-colors focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed ' +
  'disabled:text-white/30';

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
