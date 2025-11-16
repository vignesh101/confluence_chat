import { Sun, Moon, Monitor, Settings, FileText, Keyboard, Search, StopCircle, Terminal, Download } from 'lucide-react';
import { Theme } from '../types';
import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  status: string;
  onOpenSettings: () => void;
  onOpenTemplates: () => void;
  onOpenShortcuts: () => void;
  onOpenSearch: () => void;
  onOpenSystemPrompt: () => void;
  onOpenExport: () => void;
  onStopGeneration?: () => void;
  isGenerating?: boolean;
  hasMessages?: boolean;
}

export function Header({
  theme,
  onThemeChange,
  status,
  onOpenSettings,
  onOpenTemplates,
  onOpenShortcuts,
  onOpenSearch,
  onOpenSystemPrompt,
  onOpenExport,
  onStopGeneration,
  isGenerating,
  hasMessages = false,
}: HeaderProps) {
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-5 h-5" />;
      case 'dark':
        return <Moon className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M8 10h8" />
              <path d="M8 14h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">Confluence Chat</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AI-powered knowledge assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status indicator */}
          {status && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mr-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              {status}
            </div>
          )}

          {/* Stop generation button */}
          {isGenerating && onStopGeneration && (
            <button
              onClick={onStopGeneration}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors"
              title="Stop generation (Esc)"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          )}

          {/* Search button */}
          <button
            onClick={onOpenSearch}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Search in conversation (Ctrl+F)"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Export button */}
          <button
            onClick={onOpenExport}
            disabled={!hasMessages}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            title="Export conversation (Ctrl+E)"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* System prompt button */}
          <button
            onClick={onOpenSystemPrompt}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="System prompt"
          >
            <Terminal className="w-5 h-5" />
          </button>

          {/* Templates button */}
          <button
            onClick={onOpenTemplates}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Templates (Ctrl+T)"
          >
            <FileText className="w-5 h-5" />
          </button>

          {/* Keyboard shortcuts button */}
          <button
            onClick={onOpenShortcuts}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Keyboard shortcuts (Ctrl+/)"
          >
            <Keyboard className="w-5 h-5" />
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Settings (Ctrl+S)"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Theme switcher */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Change theme"
            >
              {getThemeIcon()}
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-1">
                  <button
                    onClick={() => {
                      onThemeChange('light');
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      theme === 'light' ? 'text-primary-600 dark:text-primary-400' : ''
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Light
                  </button>
                  <button
                    onClick={() => {
                      onThemeChange('dark');
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      theme === 'dark' ? 'text-primary-600 dark:text-primary-400' : ''
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Dark
                  </button>
                  <button
                    onClick={() => {
                      onThemeChange('system');
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      theme === 'system' ? 'text-primary-600 dark:text-primary-400' : ''
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    System
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
