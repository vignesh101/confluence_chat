import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ['Ctrl', 'N'], description: 'New conversation' },
  { keys: ['Ctrl', 'K'], description: 'Search conversations' },
  { keys: ['Ctrl', 'F'], description: 'Search in current conversation' },
  { keys: ['Ctrl', 'S'], description: 'Open settings' },
  { keys: ['Ctrl', 'T'], description: 'Open templates' },
  { keys: ['Ctrl', '/'], description: 'Toggle keyboard shortcuts' },
  { keys: ['Ctrl', 'B'], description: 'Toggle sidebar' },
  { keys: ['Esc'], description: 'Close dialog / Stop generation' },
  { keys: ['Enter'], description: 'Send message' },
  { keys: ['Shift', 'Enter'], description: 'New line in message' },
  { keys: ['Ctrl', 'Shift', 'C'], description: 'Copy last response' },
];

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <span key={i}>
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">
                      {key}
                    </kbd>
                    {i < shortcut.keys.length - 1 && <span className="mx-1 text-gray-400">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
