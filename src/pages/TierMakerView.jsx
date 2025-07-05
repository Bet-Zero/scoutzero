import React from 'react';
import { useParams } from 'react-router-dom';
import TierMakerBoard from '@/features/tierMaker/TierMakerBoard';

const TierMakerView = () => {
  const { tierListId } = useParams();
  return (
    <div className="bg-neutral-900 min-h-screen text-white pt-4 pb-8">
      <TierMakerBoard initialTierListId={tierListId} />
    </div>
  );
};

export default TierMakerView;
