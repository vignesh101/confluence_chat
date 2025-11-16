import { Sparkles } from 'lucide-react';

interface QuickActionsProps {
  onSelectPrompt: (prompt: string) => void;
}

const suggestedPrompts = [
  'How do I get started with...',
  'What are the best practices for...',
  'Can you explain the architecture of...',
  'What are the key differences between...',
  'How do I troubleshoot...',
  'What are the security considerations for...',
  'Can you provide examples of...',
  'What is the recommended approach for...',
];

export function QuickActions({ onSelectPrompt }: QuickActionsProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary-500" />
        <h3 className="text-sm font-medium">Quick Prompts</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestedPrompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => onSelectPrompt(prompt)}
            className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-xs hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
