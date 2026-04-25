import React from 'react';
import { Search } from 'lucide-react';

type SearchBarProps = {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const SearchBar = ({ value, onChange }: SearchBarProps) => (
  <div className="relative">
    <Search
      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black"
      size={16}
    />
    <input
      type="text"
      placeholder="Search players..."
      value={value}
      onChange={onChange}
      className="pl-10 pr-4 py-2 text-sm bg-neutral-800 border border-black rounded-md text-white placeholder-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 transition-all duration-200"
    />
  </div>
);

export default SearchBar;
