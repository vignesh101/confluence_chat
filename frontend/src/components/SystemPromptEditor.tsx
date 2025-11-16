import { useState } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';

interface SystemPromptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt: string;
  onSave: (prompt: string) => void;
}

const defaultPrompt = `You are a helpful AI assistant with access to Confluence documentation.
Answer questions based on the provided context from Confluence pages.
Always cite your sources using the provided reference numbers.
If the context doesn't contain enough information, say so clearly.`;

export function SystemPromptEditor({ isOpen, onClose, systemPrompt, onSave }: SystemPromptEditorProps) {
  const [prompt, setPrompt] = useState(systemPrompt || defaultPrompt);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">System Prompt</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Customize the system prompt to change how the AI assistant behaves in this conversation.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none font-mono text-sm"
            placeholder="Enter system prompt..."
          />
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            {prompt.length} characters
          </p>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={() => setPrompt(defaultPrompt)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(prompt);
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
