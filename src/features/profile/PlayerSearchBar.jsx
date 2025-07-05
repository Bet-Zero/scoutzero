import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const PlayerSearchBar = ({ playersData, onSelect }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!search) {
      setResults([]);
      return;
    }
    const lower = search.toLowerCase();
    const matches = Object.keys(playersData)
      .filter((id) => {
        const name =
          playersData[id]?.display_name || playersData[id]?.name || '';
        return name.toLowerCase().includes(lower);
      })
      .slice(0, 8);
    setResults(matches);
  }, [search, playersData]);

  const handleSelect = (id) => {
    if (!id) return;
    setSearch('');
    setResults([]);
    onSelect(id, playersData[id]?.bio?.Team || '');
  };

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-black"
        size={16}
      />
      <input
        type="text"
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-10 pr-3 py-2 text-sm bg-neutral-800 border border-black rounded-md text-white placeholder-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
      />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-neutral-800 border border-black rounded-md max-h-52 overflow-y-auto">
          {results.map((id) => (
            <li
              key={id}
              className="px-2 py-1 text-white hover:bg-neutral-700 cursor-pointer text-sm"
              onClick={() => handleSelect(id)}
            >
              {playersData[id]?.display_name || playersData[id]?.name || id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlayerSearchBar;
