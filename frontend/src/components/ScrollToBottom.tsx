import { ArrowDown } from 'lucide-react';

interface ScrollToBottomProps {
  show: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export function ScrollToBottom({ show, onClick, unreadCount = 0 }: ScrollToBottomProps) {
  if (!show) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-8 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all z-10"
    >
      <ArrowDown className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
