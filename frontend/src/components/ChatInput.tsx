import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  enterToSend?: boolean;
}

export function ChatInput({ onSend, disabled, isLoading, value, onChange, enterToSend = true }: ChatInputProps) {
  const [internalInput, setInternalInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use controlled or uncontrolled mode
  const input = value !== undefined ? value : internalInput;
  const setInput = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalInput(newValue);
    }
  };

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled && !isLoading) {
      onSend(trimmed);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end gap-3 bg-gray-100 dark:bg-gray-700 rounded-xl p-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your Confluence content..."
            disabled={disabled || isLoading}
            rows={1}
            className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 scrollbar-thin"
            style={{ maxHeight: '200px' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled || isLoading}
            className="flex-shrink-0 p-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
