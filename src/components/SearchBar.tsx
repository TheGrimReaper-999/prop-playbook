import { useState, useRef, useEffect } from 'react';
import { Search, User, Users } from 'lucide-react';
import { useAutocomplete, SearchResult } from '@/hooks/useAutocomplete';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onSelect?: (result: SearchResult) => void;
}

const SearchBar = ({ onSearch, onSelect }: SearchBarProps) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { results, isLoading } = useAutocomplete(query);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open dropdown when results exist
  useEffect(() => {
    if (results.length > 0 && query.length >= 2) {
      setIsOpen(true);
      setSelectedIndex(-1);
    } else {
      setIsOpen(false);
    }
  }, [results, query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    } else {
      onSearch?.(query);
      setIsOpen(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setQuery(result.name);
    setIsOpen(false);
    onSelect?.(result);
    onSearch?.(result.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="search-wrapper">
      <form onSubmit={handleSubmit}>
        <Search className="search-icon" size={24} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && query.length >= 2 && setIsOpen(true)}
          placeholder="Search player or team name..."
          className="search-input pl-14"
          autoComplete="off"
        />
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="autocomplete-dropdown">
          {isLoading ? (
            <div className="autocomplete-loading">
              <div className="loading-spinner" />
              <span>Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <ul className="autocomplete-list">
              {results.map((result, index) => (
                <li
                  key={result.id}
                  className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="autocomplete-icon">
                    {result.type === 'player' ? (
                      <User size={18} />
                    ) : (
                      <Users size={18} />
                    )}
                  </div>
                  <div className="autocomplete-content">
                    <span className="autocomplete-name">{result.name}</span>
                    {result.type === 'player' && result.teamName && (
                      <span className="autocomplete-team">{result.teamName}</span>
                    )}
                  </div>
                  <span className={`autocomplete-badge ${result.type}`}>
                    {result.type === 'player' ? 'Player' : 'Team'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="autocomplete-empty">No results found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
