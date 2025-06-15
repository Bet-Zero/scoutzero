import React, { useState, useEffect } from 'react';

const getTraitColor = (rating) => {
  if (rating >= 98) return '#13895b';
  if (rating >= 94) return '#369972';
  if (rating >= 91) return '#55b48f';
  if (rating >= 86) return '#6cbd9d';
  if (rating >= 80) return '#8bc8b0';
  if (rating >= 73) return '#bce6df';
  if (rating >= 66) return '#d9efe6';
  if (rating >= 56) return '#efd9d9';
  if (rating >= 46) return '#e6bcbc';
  if (rating >= 41) return '#c88b8b';
  if (rating >= 36) return '#bd6c6c';
  if (rating >= 26) return '#b45555';
  if (rating >= 16) return '#993636';
  return '#891313';
};

const OverallGradeBlock = ({ grade, onGradeChange, readOnly = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(
    typeof grade === 'number' ? grade.toString() : ''
  );

  useEffect(() => {
    setInputValue(typeof grade === 'number' ? grade.toString() : '');
  }, [grade]);

  const color =
    typeof grade === 'number' ? getTraitColor(grade) : 'transparent';
  const rounded = typeof grade === 'number' ? Math.round(grade) : '—';

  const handleSubmit = () => {
    const parsed = parseInt(inputValue);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onGradeChange?.(parsed);
    }
    setIsEditing(false);
  };

  if (readOnly) {
    return (
      <div
        className="w-[84px] h-[60px] rounded-md border-2 border-black flex items-center justify-center"
        style={{ backgroundColor: color }}
        title="Overall Grade"
      >
        <span className="text-black text-lg font-bold leading-none">
          {rounded}
        </span>
      </div>
    );
  }

  return isEditing ? (
    <input
      autoFocus
      type="number"
      min={0}
      max={100}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onBlur={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSubmit();
        else if (e.key === 'Escape') setIsEditing(false);
      }}
      className="w-[84px] h-[60px] rounded-md border-2 border-black text-center text-lg font-bold bg-neutral-800 text-white outline-none"
    />
  ) : (
    <div
      onClick={() => setIsEditing(true)}
      className="w-[84px] h-[60px] rounded-md border-2 border-black flex items-center justify-center cursor-pointer"
      style={{ backgroundColor: color }}
      title="Click to edit"
    >
      <span className="text-black text-lg font-bold leading-none">
        {rounded}
      </span>
    </div>
  );
};

export default OverallGradeBlock;
