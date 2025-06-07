import React from 'react';

const OverallBlurbMini = ({ text }) => {
  return (
    <div className="w-[320px] h-[120px] bg-neutral-900 rounded-xl p-2 flex flex-col gap-3 border border-black">
      <label className="text-white/50 text-sm mb-1">Overall</label>
      <div className="text-white/50 text-sm leading-relaxed whitespace-pre-wrap">
        {text || (
          <span className="text-white/50 italic">No summary provided.</span>
        )}
      </div>
    </div>
  );
};

export default OverallBlurbMini;
