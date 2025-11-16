import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  User,
  Bot,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  BookmarkCheck,
  Edit3,
  Trash2,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import { Message } from '../types';
import { format } from 'date-fns';
import clsx from 'clsx';

interface ChatMessageProps {
  message: Message;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: number) => void;
  onBookmark?: (messageId: string) => void;
  showTimestamps?: boolean;
  density?: 'compact' | 'comfortable' | 'spacious';
  fontSize?: 'small' | 'medium' | 'large';
}

export function ChatMessage({
  message,
  onEdit,
  onDelete,
  onRegenerate,
  onFeedback,
  onBookmark,
  showTimestamps = true,
  density = 'comfortable',
  fontSize = 'medium',
}: ChatMessageProps) {
  const [showDebug, setShowDebug] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && onEdit) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const paddingClass = {
    compact: 'p-3',
    comfortable: 'p-6',
    spacious: 'p-8',
  }[density];

  const fontSizeClass = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  }[fontSize];

  return (
    <div
      id={`message-${message.id}`}
      className={clsx(
        'flex gap-4 group relative',
        paddingClass,
        isUser ? 'bg-transparent' : 'bg-gray-50 dark:bg-gray-800/50',
        message.isBookmarked && 'border-l-4 border-yellow-400'
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary-600 text-white' : 'bg-emerald-600 text-white'
        )}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-sm">{isUser ? 'You' : 'Assistant'}</span>
          {showTimestamps && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {format(new Date(message.timestamp), 'HH:mm')}
            </span>
          )}
          {message.isEdited && (
            <span className="text-xs text-gray-500 dark:text-gray-400 italic">(edited)</span>
          )}
          {message.isBookmarked && <BookmarkCheck className="w-4 h-4 text-yellow-500" />}
        </div>

        {/* Message text */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
              rows={5}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm font-medium"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={clsx('prose max-w-none', fontSizeClass)}>
            {message.isStreaming && !message.content ? (
              <div className="flex items-center gap-1">
                <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
                <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
                <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!isEditing && message.content && !message.isStreaming && (
          <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Copy"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {onBookmark && (
              <button
                onClick={() => onBookmark(message.id)}
                className={clsx(
                  'inline-flex items-center gap-1 text-xs transition-colors',
                  message.isBookmarked
                    ? 'text-yellow-500 hover:text-yellow-600'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                )}
                title={message.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
              >
                {message.isBookmarked ? (
                  <BookmarkCheck className="w-3.5 h-3.5" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {!isUser && onFeedback && (
              <>
                <button
                  onClick={() => onFeedback(message.id, message.feedback === 1 ? 0 : 1)}
                  className={clsx(
                    'inline-flex items-center gap-1 text-xs transition-colors',
                    message.feedback === 1
                      ? 'text-green-500 hover:text-green-600'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  )}
                  title="Good response"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback(message.id, message.feedback === -1 ? 0 : -1)}
                  className={clsx(
                    'inline-flex items-center gap-1 text-xs transition-colors',
                    message.feedback === -1
                      ? 'text-red-500 hover:text-red-600'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  )}
                  title="Bad response"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {!isUser && onRegenerate && (
              <button
                onClick={() => onRegenerate(message.id)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {showMenu && (
                <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                  <div className="p-1">
                    {onEdit && (
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => {
                          if (confirm('Delete this message?')) {
                            onDelete(message.id);
                          }
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Debug info */}
        {message.debugInfo && (
          <div className="mt-4">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              {showDebug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Query Details
            </button>

            {showDebug && (
              <div className="mt-3 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg text-xs space-y-3">
                <div>
                  <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Original Query</div>
                  <div className="text-gray-600 dark:text-gray-400">{message.debugInfo.original_query}</div>
                </div>

                {message.debugInfo.expanded_queries.length > 0 && (
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Expanded Queries</div>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-400">
                      {message.debugInfo.expanded_queries.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Pages Searched</div>
                    <div className="text-gray-600 dark:text-gray-400">{message.debugInfo.pages_searched}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Chunks Selected</div>
                    <div className="text-gray-600 dark:text-gray-400">{message.debugInfo.chunks_selected}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
