import React, { useState } from 'react'
import { getColor } from '../utils/colorScale'

const traits = ["Shooting", "Passing", "Playmaking", "Rebounding", "Defense", "IQ", "Feel", "Energy"]

const TraitCard = () => {
  const [ratings, setRatings] = useState({
    Shooting: 88,
    Passing: 75,
    Playmaking: 91,
    Rebounding: 64,
    Defense: 55,
    IQ: 97,
    Feel: 82,
    Energy: 85
  })

  const updateRating = (trait, x, width) => {
    const percent = Math.round((x / width) * 100)
    setRatings({ ...ratings, [trait]: percent })
  }

  return (
    <div className="bg-neutral-800 p-4 rounded-xl w-[270px] h-[500px] flex flex-col justify-center gap-2 shadow-lg">
      {traits.map((trait) => (
        <div
          key={trait}
          className="h-9 w-full rounded-full px-4 text-sm font-semibold text-black flex justify-between items-center"
          style={{ backgroundColor: getColor(ratings[trait]) }}
          onClick={(e) => updateRating(trait, e.nativeEvent.offsetX, e.currentTarget.offsetWidth)}
        >
          <span>{trait}</span>
          <span>{ratings[trait]}</span>
        </div>
      ))}
    </div>
  )
}

export default TraitCard