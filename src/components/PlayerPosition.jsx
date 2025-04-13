import React from "react";

const PlayerPosition = ({ position = "SF" }) => {
  return (
    <span className="text-black text-[2.7rem] font-semibold">{position}</span>
  );
};

export default PlayerPosition;
