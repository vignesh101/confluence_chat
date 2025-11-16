import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';

interface SearchResult {
  id: string;
  content: string;
  role: string;
}

interface SearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string | null;
  onJumpToMessage: (messageId: string) => void;
}

export function SearchBar({ isOpen, onClose, conversationId, onJumpToMessage }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const searchMessages = async () => {
      if (!query || query.length < 2 || !conversationId) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/search?q=${encodeURIComponent(query)}`
        );
        if (response.ok) {
          const data = await response.json();
          setResults(data);
          setCurrentIndex(0);
          if (data.length > 0) {
            onJumpToMessage(data[0].id);
          }
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchMessages, 300);
    return () => clearTimeout(debounce);
  }, [query, conversationId, onJumpToMessage]);

  const handlePrevious = () => {
    if (results.length === 0) return;
    const newIndex = (currentIndex - 1 + results.length) % results.length;
    setCurrentIndex(newIndex);
    onJumpToMessage(results[newIndex].id);
  };

  const handleNext = () => {
    if (results.length === 0) return;
    const newIndex = (currentIndex + 1) % results.length;
    setCurrentIndex(newIndex);
    onJumpToMessage(results[newIndex].id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handlePrevious();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleNext();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 shadow-lg z-20">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search in conversation..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
          />
        </div>

        {results.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {currentIndex + 1} of {results.length}
            </span>
            <button
              onClick={handlePrevious}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Previous (Shift+Enter)"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Next (Enter)"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {query && !isSearching && results.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">No results found</p>
      )}
    </div>
  );
}
