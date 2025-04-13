// PlayerName.jsx
import React from "react";

const PlayerName = ({ name = "LeBron James" }) => {
  const [firstName, lastName] = name.split(" ");

  return (
    <div className="flex flex-col items-start justify-start w-[220px] leading-none">
      <h1
        className="font-anton font-bold text-black uppercase"
        style={{
          fontSize: "clamp(24px, 6vw, 64px)",
          lineHeight: "1.05",
          marginBottom: "-4px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {firstName}
      </h1>
      <h1
        className="font-anton font-bold text-black uppercase"
        style={{
          fontSize: lastName.length > 13 ? "28px" : lastName.length > 11 ? "32px" : lastName.length > 9 ? "36px" : "40px",
          lineHeight: "1.05",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {lastName}
      </h1>
    </div>
  );
};

export default PlayerName;
