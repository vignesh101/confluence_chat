import { useState, useRef, useEffect } from 'react';
import {
  MessageSquarePlus,
  Search,
  Trash2,
  Edit3,
  Check,
  X,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Download,
  Upload,
  BarChart3,
  Trash,
  MoreVertical,
} from 'lucide-react';
import { Conversation, ConversationStats, DateGroup } from '../types';
import { formatDistanceToNow, isToday, isYesterday, differenceInDays } from 'date-fns';
import clsx from 'clsx';

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onPinConversation: (id: string) => void;
  onArchiveConversation: (id: string) => void;
  onUnarchiveConversation: (id: string) => void;
  onExportConversation: (id: string) => void;
  onImportConversation: (data: unknown) => void;
  onClearHistory: (includePinned: boolean) => void;
  stats: ConversationStats | null;
  onRefreshStats: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  showArchived: boolean;
  onToggleShowArchived: () => void;
}

function groupConversationsByDate(conversations: Conversation[]): Map<DateGroup, Conversation[]> {
  const groups = new Map<DateGroup, Conversation[]>();

  const pinnedConvs = conversations.filter(c => c.is_pinned);
  const unpinnedConvs = conversations.filter(c => !c.is_pinned);

  if (pinnedConvs.length > 0) {
    groups.set('pinned', pinnedConvs);
  }

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const last7days: Conversation[] = [];
  const last30days: Conversation[] = [];
  const older: Conversation[] = [];

  for (const conv of unpinnedConvs) {
    const date = new Date(conv.updated_at);
    const daysDiff = differenceInDays(new Date(), date);

    if (isToday(date)) {
      today.push(conv);
    } else if (isYesterday(date)) {
      yesterday.push(conv);
    } else if (daysDiff <= 7) {
      last7days.push(conv);
    } else if (daysDiff <= 30) {
      last30days.push(conv);
    } else {
      older.push(conv);
    }
  }

  if (today.length > 0) groups.set('today', today);
  if (yesterday.length > 0) groups.set('yesterday', yesterday);
  if (last7days.length > 0) groups.set('last7days', last7days);
  if (last30days.length > 0) groups.set('last30days', last30days);
  if (older.length > 0) groups.set('older', older);

  return groups;
}

const groupLabels: Record<DateGroup, string> = {
  pinned: 'Pinned',
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 Days',
  last30days: 'Last 30 Days',
  older: 'Older',
};

export function Sidebar({
  conversations,
  currentConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onPinConversation,
  onArchiveConversation,
  onUnarchiveConversation,
  onExportConversation,
  onImportConversation,
  onClearHistory,
  stats,
  onRefreshStats,
  isCollapsed,
  onToggleCollapse,
  showArchived,
  onToggleShowArchived,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredConversations = searchQuery
    ? conversations.filter((conv) =>
        conv.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const groupedConversations = groupConversationsByDate(filteredConversations);

  const handleStartEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
    setShowMenu(null);
  };

  const handleSaveEdit = () => {
    if (editingId && editingTitle.trim()) {
      onRenameConversation(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          onImportConversation(data);
        } catch {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  if (isCollapsed) {
    return (
      <div className="w-16 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg mb-4"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={onNewConversation}
          className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
          title="New conversation"
        >
          <MessageSquarePlus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onRefreshStats();
                setShowStatsPanel(!showStatsPanel);
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Statistics"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors"
        >
          <MessageSquarePlus className="w-5 h-5" />
          New Conversation
        </button>
      </div>

      {/* Stats Panel */}
      {showStatsPanel && stats && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-sm mb-3">Statistics</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Total</div>
              <div className="font-medium">{stats.total_conversations}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Active</div>
              <div className="font-medium">{stats.active_conversations}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Pinned</div>
              <div className="font-medium">{stats.pinned_conversations}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Archived</div>
              <div className="font-medium">{stats.archived_conversations}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Messages</div>
              <div className="font-medium">{stats.total_messages}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Avg/Conv</div>
              <div className="font-medium">{stats.average_messages_per_conversation}</div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Actions */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={onToggleShowArchived}
              className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            Show archived
          </label>

          <div className="flex items-center gap-1">
            <button
              onClick={handleImportClick}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
              title="Import conversation"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowClearDialog(true)}
              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
              title="Clear history"
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations found</p>
          </div>
        ) : (
          <div className="p-2">
            {Array.from(groupedConversations.entries()).map(([group, convs]) => (
              <div key={group} className="mb-4">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {groupLabels[group]}
                </div>
                <div className="space-y-1">
                  {convs.map((conv) => (
                    <div
                      key={conv.id}
                      className={clsx(
                        'group relative rounded-lg transition-colors',
                        currentConversationId === conv.id
                          ? 'bg-primary-50 dark:bg-primary-900/20'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700/50',
                        conv.is_archived && 'opacity-60'
                      )}
                    >
                      {editingId === conv.id ? (
                        <div className="p-3">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none"
                            autoFocus
                          />
                          <div className="flex gap-1 mt-2">
                            <button
                              onClick={handleSaveEdit}
                              className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectConversation(conv.id)}
                          className="w-full text-left p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                {conv.is_pinned && (
                                  <Pin className="w-3 h-3 text-primary-500 flex-shrink-0" />
                                )}
                                {conv.is_archived && (
                                  <Archive className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                )}
                                <h3 className="font-medium text-sm truncate">{conv.title}</h3>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                              </p>
                              {conv.preview && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                  {conv.preview}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                              {conv.message_count}
                            </span>
                          </div>
                        </button>
                      )}

                      {/* Action menu button */}
                      {editingId !== conv.id && (
                        <div className="absolute right-2 top-2 hidden group-hover:block" ref={showMenu === conv.id ? menuRef : null}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMenu(showMenu === conv.id ? null : conv.id);
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {showMenu === conv.id && (
                            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                              <div className="p-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onPinConversation(conv.id);
                                    setShowMenu(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {conv.is_pinned ? (
                                    <>
                                      <PinOff className="w-3.5 h-3.5" />
                                      Unpin
                                    </>
                                  ) : (
                                    <>
                                      <Pin className="w-3.5 h-3.5" />
                                      Pin
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(conv);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Rename
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onExportConversation(conv.id);
                                    setShowMenu(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Export
                                </button>
                                {conv.is_archived ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUnarchiveConversation(conv.id);
                                      setShowMenu(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    <ArchiveRestore className="w-3.5 h-3.5" />
                                    Unarchive
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onArchiveConversation(conv.id);
                                      setShowMenu(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                    Archive
                                  </button>
                                )}
                                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete this conversation?')) {
                                      onDeleteConversation(conv.id);
                                    }
                                    setShowMenu(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clear History Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Clear History</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will permanently delete all conversations. This action cannot be undone.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  onClearHistory(false);
                  setShowClearDialog(false);
                }}
                className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
              >
                Clear All (Keep Pinned)
              </button>
              <button
                onClick={() => {
                  if (confirm('This will delete ALL conversations including pinned ones. Are you absolutely sure?')) {
                    onClearHistory(true);
                    setShowClearDialog(false);
                  }
                }}
                className="w-full py-2 px-4 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-medium"
              >
                Clear Everything
              </button>
              <button
                onClick={() => setShowClearDialog(false)}
                className="w-full py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
