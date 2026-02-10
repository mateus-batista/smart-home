import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search...' }: SearchInputProps) {
  return (
    <div className="p-3 border-b border-white/[0.06] shrink-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full py-2 pl-9 pr-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-all"
        />
      </div>
    </div>
  );
}
