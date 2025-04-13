// BioCard.jsx
import React from "react";

const BioCard = () => {
  return (
    <div className="w-[1228px] h-[220px] bg-[#1f1f1f] rounded-2xl shadow-lg px-10 py-6 flex justify-between text-white">
      {/* Bio Info */}
      <div className="text-lg space-y-1">
        <p className="opacity-50">[Bio Info Placeholder]</p>
      </div>

      {/* Stats Info */}
      <div className="text-lg w-[700px] pl-10">
        <p className="opacity-50">[Stats Placeholder]</p>
      </div>
    </div>
  );
};

export default BioCard;
