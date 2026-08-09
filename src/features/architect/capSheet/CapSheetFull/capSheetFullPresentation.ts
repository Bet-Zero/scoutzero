export const normalizeFAType = (
  type: string | null | undefined
): string | null => {
  if (!type) return null;
  const normalized = type.toLowerCase();
  if (normalized === 'unrestricted' || normalized === 'ufa') return 'UFA';
  if (normalized === 'restricted' || normalized === 'rfa') return 'RFA';
  return type.toUpperCase();
};

export const getTagColor = (type: string | null): string => {
  const base =
    'border shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] bg-gradient-to-b';
  if (type === 'UFA')
    return `${base} from-blue-400/40 to-blue-600/40 border-blue-300/40 text-blue-50`;
  if (type === 'RFA')
    return `${base} from-rose-400/40 to-rose-600/40 border-rose-300/40 text-rose-50`;
  if (type === 'PO')
    return `${base} from-emerald-400/40 to-emerald-600/40 border-emerald-300/40 text-emerald-50`;
  if (type === 'TO')
    return `${base} from-amber-400/40 to-amber-600/40 border-amber-300/40 text-amber-50`;
  if (type === 'TWO-WAY')
    return `${base} from-white/15 to-white/5 border-white/20 text-white/70`;
  return `${base} from-slate-500/40 to-slate-700/40 border-slate-400/30 text-slate-50`;
};
