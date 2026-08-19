import React from 'react';

import type { OfferSheetTimingLike } from './EditContractModal.types';

type GovernedOfferSheetNoticeFormProps = {
  value: OfferSheetTimingLike;
  onChange: React.Dispatch<React.SetStateAction<OfferSheetTimingLike>>;
  onTermsChange: () => void;
};

export const GovernedOfferSheetNoticeForm = ({
  value,
  onChange,
  onTermsChange,
}: GovernedOfferSheetNoticeFormProps) => (
  <div className="mb-4 grid gap-3 rounded-lg border border-cyan-400/25 bg-cyan-500/10 p-4 md:grid-cols-2">
    <div className="md:col-span-2">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
        Offer Sheet notice
      </div>
      <p className="mt-1 text-[11px] text-cyan-50/70">
        Record the exact Eastern signing and receipt times. The matching window
        is calculated from receipt; neither time is inferred.
      </p>
    </div>
    <label className="text-xs text-white/70">
      Exact signature time
      <input
        data-testid="governed-offer-sheet-signed-at"
        value={value.signedAt}
        onChange={(event) => {
          onTermsChange();
          onChange((current) => ({
            ...current,
            signedAt: event.target.value,
          }));
        }}
        placeholder="2026-07-08T09:55:00-04:00"
        className="mt-1 w-full rounded border border-white/15 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50"
      />
      <span className="mt-1 block text-[10px] text-white/45">
        Include the Eastern UTC offset.
      </span>
    </label>
    <label className="text-xs text-white/70">
      Exact Team receipt time
      <input
        data-testid="governed-offer-sheet-received-at"
        value={value.receivedAt}
        onChange={(event) => {
          onTermsChange();
          onChange((current) => ({
            ...current,
            receivedAt: event.target.value,
          }));
        }}
        placeholder="2026-07-08T10:00:00-04:00"
        className="mt-1 w-full rounded border border-white/15 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50"
      />
      <span className="mt-1 block text-[10px] text-white/45">
        This instant starts the Exercise Notice deadline.
      </span>
    </label>
  </div>
);
