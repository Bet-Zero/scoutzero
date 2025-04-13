import React from "react";

const TeamLogo = ({ teamLogo }) => {
  return (
    <img
      src={teamLogo}
      alt="Team Logo"
      className="w-[3.5rem] h-[3.5rem] object-contain"
    />
  );
};

export default TeamLogo;
