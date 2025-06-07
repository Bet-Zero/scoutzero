import React from 'react';

const PlayerHeadshot = ({ src }) => {
  return (
    <div className="w-[200px] h-[200px] rounded-xl overflow-hidden border-2 border-black">
      <img
        src={src}
        alt="Player headshot"
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default PlayerHeadshot;
