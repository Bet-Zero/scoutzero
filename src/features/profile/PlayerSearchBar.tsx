import React, { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { PlayersDataMap } from './utils/profileHelpers';

export const PlayerSearchBar = ({
  playersData,
  onSelect,
}: {
  playersData: PlayersDataMap;
  onSelect: (playerId: string, team: string) => void;
}) => {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const results = useMemo(() => {
    if (!search) return [];
    const lower = search.toLowerCase();
    return Object.keys(playersData)
      .filter((id) => {
        const name =
          playersData[id]?.bio?.displayName || playersData[id]?.name || '';
        return name.toLowerCase().includes(lower);
      })
      .slice(0, 8);
  }, [search, playersData]);

  // Reset the keyboard highlight whenever the result set changes.
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  const handleSelect = (id: string) => {
    if (!id) return;
    setSearch('');
    setActiveIndex(-1);
    onSelect(id, playersData[id]?.bio?.display?.team || '');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (event.key === 'Enter') {
      const target = activeIndex >= 0 ? results[activeIndex] : results[0];
      if (target) {
        event.preventDefault();
        handleSelect(target);
      }
    } else if (event.key === 'Escape') {
      setActiveIndex(-1);
      setSearch('');
    }
  };

  const listboxId = 'player-search-results';

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"
        size={16}
      />
      <input
        type="text"
        placeholder="Search players..."
        aria-label="Search players"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-${results[activeIndex]}` : undefined
        }
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        className="pl-10 pr-3 py-2 text-sm bg-neutral-800 border border-black rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
      />
      {results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Player search results"
          className="absolute z-10 mt-1 w-full bg-neutral-800 border border-black rounded-md max-h-52 overflow-y-auto"
        >
          {results.map((id, index) => (
            <li
              key={id}
              id={`${listboxId}-${id}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`px-2 py-1 text-white cursor-pointer text-sm ${
                index === activeIndex ? 'bg-neutral-700' : 'hover:bg-neutral-700'
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => handleSelect(id)}
            >
              {playersData[id]?.bio?.displayName || playersData[id]?.name || id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
