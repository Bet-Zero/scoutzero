import React from 'react';
import { Search } from 'lucide-react';

const SearchBar = ({ onChange }) => (
  <div className="relative">
    <Search
      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
      size={16}
    />
    <input
      type="text"
      placeholder="Search players..."
      onChange={onChange}
      className="pl-10 pr-4 py-2 text-sm bg-black border border-gray-700 rounded-md text-white placeholder-gray-00 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 transition-all duration-200"
    />
  </div>
);

export default SearchBar;
