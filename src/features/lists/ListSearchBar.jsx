import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const ListSearchBar = ({
  listsData,
  onSelect,
  placeholder = 'Search lists...',
}) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!search) {
      setResults([]);
      return;
    }
    const lower = search.toLowerCase();
    const matches = Object.keys(listsData)
      .filter((id) => listsData[id]?.name?.toLowerCase().includes(lower))
      .slice(0, 8);
    setResults(matches);
  }, [search, listsData]);

  const handleSelect = (id) => {
    if (!id) return;
    setSearch('');
    setResults([]);
    onSelect?.(id);
  };

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"
        size={16}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-8 pr-3 py-1 text-sm bg-neutral-800 border border-white/20 rounded-md text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
      />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-neutral-800 border border-white/20 rounded-md max-h-52 overflow-y-auto">
          {results.map((id) => (
            <li
              key={id}
              className="px-2 py-1 text-white hover:bg-neutral-700 cursor-pointer text-sm"
              onClick={() => handleSelect(id)}
            >
              {listsData[id]?.name || id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ListSearchBar;
