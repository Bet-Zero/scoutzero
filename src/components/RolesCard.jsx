// RolesCard.jsx
import React from "react";

const RolesCard = () => {
  return (
    <div className="bg-[#1f1f1f] rounded-2xl shadow-lg p-6 w-[500px] h-[500px] flex flex-col justify-between">
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Offense</h2>
        <ul className="space-y-2 text-white">
          <li className="bg-[#333] rounded-lg px-4 py-2">Primary Playmaker</li>
          <li className="bg-[#333] rounded-lg px-4 py-2">Shot Creator</li>
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white mt-6 mb-4">Defense</h2>
        <ul className="space-y-2 text-white">
          <li className="bg-[#333] rounded-lg px-4 py-2">Wing Stopper</li>
          <li className="bg-[#333] rounded-lg px-4 py-2">Help Defender</li>
        </ul>
      </div>
      <div className="mt-6">
        <h2 className="text-xl font-semibold text-white mb-2 text-center">Two-Way Meter</h2>
        <div className="relative h-4 w-full bg-gradient-to-r from-red-500 via-yellow-300 to-green-500 rounded-full">
          <div className="absolute top-[-6px] left-[65%] w-4 h-4 bg-white rounded-full border border-gray-700"></div>
        </div>
        <div className="flex justify-between text-sm text-gray-400 mt-1">
          <span>DEFENSE</span>
          <span>OFFENSE</span>
        </div>
      </div>
    </div>
  );
};

export default RolesCard;
