import React from "react";
import TeamLogo from "./TeamLogo";
import PlayerPosition from "./PlayerPosition";

const PlayerInfoCard = ({ name = "LeBron James", position = "SF", teamLogo, playerId = "2544" }) => {
  const imageUrl = `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;

  return (
    <div className="w-[750px] h-[220px] flex bg-[#1f1f1f] rounded-2xl shadow-lg px-6 py-4">
      {/* Headshot */}
      <div className="w-[160px] h-[160px] rounded-xl overflow-hidden border-2 border-black">
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      </div>

      {/* Info */}
      <div className="flex flex-col justify-center ml-6">
        <h1 className="text-5xl font-impact text-black leading-tight mb-1">{name.split(" ")[0]}</h1>
        <h1 className="text-5xl font-impact text-black leading-tight">{name.split(" ")[1]}</h1>
        <div className="flex items-center mt-4 gap-2">
          <TeamLogo teamLogo={teamLogo} />
          <div className="h-6 w-[1px] bg-black" />
          <PlayerPosition position={position} />
        </div>
      </div>
    </div>
  );
};

export default PlayerInfoCard;
