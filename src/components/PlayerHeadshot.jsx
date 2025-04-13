import React from "react";

const PlayerHeadshot = ({ playerId = "2544", name = "LeBron James" }) => {
  const imageUrl = `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;

  return (
    <div className="w-[200px] h-[200px] rounded-xl overflow-hidden border-2 border-black">
      <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
    </div>
  );
};

export default PlayerHeadshot;
