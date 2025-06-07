import React, { useRef, useLayoutEffect, useState } from 'react';

const formatFullName = (name) => {
  if (!name) return ['', ''];
  const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'v'];

  const words = name
    .trim()
    .split(' ')
    .map((word) => {
      if (suffixes.includes(word.toLowerCase())) return word.toUpperCase();
      if (word.length <= 2 && word === word.toUpperCase()) return word;
      if (word.includes("'")) {
        return word
          .split("'")
          .map(
            (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          )
          .join("'");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

  const first = words[0] || '';
  const last = words.slice(1).join(' ') || '';
  return [first, last];
};

const AutoShrinkText = ({ text, maxFontSize, minFontSize }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    let size = maxFontSize;

    while (size >= minFontSize) {
      textEl.style.fontSize = `${size}px`;
      if (textEl.scrollWidth <= container.offsetWidth) break;
      size -= 1;
    }

    setFontSize(size);
  }, [text, maxFontSize, minFontSize]);

  return (
    <div
      ref={containerRef}
      className="w-[300px] overflow-hidden whitespace-nowrap"
      style={{ height: 'auto' }}
    >
      <div
        ref={textRef}
        className="font-anton font-bold text-black uppercase leading-none text-ellipsis"
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: '1.05',
        }}
      >
        {text}
      </div>
    </div>
  );
};

const PlayerName = ({ name = 'LeBron James' }) => {
  const [firstName, lastName] = formatFullName(name);
  const isGiannis = name.toLowerCase().includes('giannis');

  return (
    <div className="flex flex-col items-start justify-start w-[300px] h-[125px] leading-tight">
      <AutoShrinkText
        text={firstName}
        maxFontSize={isGiannis ? 50 : 48}
        minFontSize={isGiannis ? 36 : 28}
      />
      <AutoShrinkText
        text={lastName}
        maxFontSize={isGiannis ? 36 : 64}
        minFontSize={isGiannis ? 18 : 24}
      />
    </div>
  );
};

export default PlayerName;
