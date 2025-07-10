import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

const ListSearchBar = ({
  listsData,
  playersData = {},
  onSelect,
  placeholder = 'Search lists...',
}) => {
  const [search, setSearch] = useState('');
  const [listResults, setListResults] = useState([]);
  const [playerResults, setPlayerResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Close suggestions when clicking outside the search area
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!search) {
      setListResults([]);
      setPlayerResults([]);
      return;
    }

    const lower = search.toLowerCase();

    // Lists matching the input
    const listMatches = Object.keys(listsData)
      .filter((id) => listsData[id]?.name?.toLowerCase().includes(lower))
      .slice(0, 8);
    setListResults(listMatches);

    // Players matching the input and the lists they are in
    const matchedPlayers = Object.keys(playersData)
      .filter((id) => {
        const name =
          playersData[id]?.display_name || playersData[id]?.name || '';
        return name.toLowerCase().includes(lower);
      })
      .slice(0, 5)
      .map((id) => {
        const lists = Object.keys(listsData).filter((listId) =>
          listsData[listId]?.playerIds?.includes(id)
        );
        return {
          id,
          name: playersData[id]?.display_name || playersData[id]?.name || id,
          lists,
        };
      })
      .filter((p) => p.lists.length > 0);
    setPlayerResults(matchedPlayers);
  }, [search, listsData, playersData]);

  const handleSelect = (id) => {
    if (!id) return;
    setSearch('');
    setListResults([]);
    setPlayerResults([]);
    setShowSuggestions(false);
    onSelect?.(id);
  };

  return (
    <div className="relative z-50" ref={wrapperRef}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"
        size={16}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowSuggestions(true);
        }}
        className="pl-8 pr-3 py-1 text-sm bg-neutral-800 border border-white/20 rounded-md text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
      />
      {showSuggestions &&
        (listResults.length > 0 || playerResults.length > 0) && (
          <>
            <div
              className="fixed inset-0 z-[1000] bg-black/40"
              onClick={() => setShowSuggestions(false)}
            />
            <div className="absolute z-[1010] mt-1 w-full bg-neutral-800 border border-white/20 rounded-md max-h-60 overflow-y-auto text-sm">
              {listResults.length > 0 && (
                <>
                  <div className="px-2 py-1 text-white/50 text-xs uppercase">
                    Lists
                  </div>
                  {listResults.map((id) => (
                    <div
                      key={`list-${id}`}
                      className="px-2 py-1 text-white hover:bg-neutral-700 cursor-pointer"
                      onClick={() => handleSelect(id)}
                    >
                      {listsData[id]?.name || id}
                    </div>
                  ))}
                </>
              )}
              {playerResults.length > 0 && (
                <>
                  <div className="px-2 py-1 text-white/50 text-xs uppercase border-t border-white/10">
                    Players
                  </div>
                  {playerResults.map((player) => (
                    <div
                      key={`player-${player.id}`}
                      className="px-2 py-1 text-white/90"
                    >
                      <div className="font-semibold text-white mb-1">
                        {player.name}
                      </div>
                      {player.lists.map((lid) => (
                        <div
                          key={lid}
                          className="ml-2 px-2 py-1 hover:bg-neutral-700 cursor-pointer"
                          onClick={() => handleSelect(lid)}
                        >
                          {listsData[lid]?.name || lid}
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}
    </div>
  );
};

export default ListSearchBar;
