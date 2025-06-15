import React from 'react';
import OverallGradeBlock from '@/components/shared/ui/grades/OverallGradeBlock';

const OverallBlurbBox = ({
  overallBlurb,
  setOverallBlurb,
  overallGrade,
  setOverallGrade,
}) => {
  return (
    <div className="w-full max-w-[750px] bg-neutral-800 rounded-xl p-4 flex flex-col gap-3">
      <label className="text-white text-sm mb-1">Overall</label>

      <div className="flex w-full gap-4">
        <textarea
          value={overallBlurb}
          onChange={(e) => setOverallBlurb(e.target.value)}
          placeholder="Write your overall scouting summary..."
          className="flex-grow h-32 bg-neutral-900 text-white p-3 rounded-lg text-sm resize-none outline-none border border-neutral-700"
        />

        <div className="flex flex-col items-center pr-1 -mt-6">
          <label className="text-white text-sm mb-[4px] text-center">
            Grade
          </label>
          <OverallGradeBlock
            grade={overallGrade}
            onGradeChange={(val) => {
              setOverallGrade(val);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default OverallBlurbBox;
