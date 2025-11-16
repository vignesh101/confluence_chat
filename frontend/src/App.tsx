import { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { EmptyState } from './components/EmptyState';
import { SettingsPanel } from './components/SettingsPanel';
import { TemplatesPanel } from './components/TemplatesPanel';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { SearchBar } from './components/SearchBar';
import { SystemPromptEditor } from './components/SystemPromptEditor';
import { ScrollToBottom } from './components/ScrollToBottom';
import { QuickActions } from './components/QuickActions';
import { ExportModal } from './components/ExportModal';
import { useWebSocket } from './hooks/useWebSocket';
import { useTheme } from './hooks/useTheme';
import {
  Message,
  Conversation,
  ConversationStats,
  WebSocketMessage,
  QueryDebugInfo,
  Template,
  AppSettings,
} from './types';
import { AlertCircle, WifiOff } from 'lucide-react';

const defaultSettings: AppSettings = {
  fontSize: 'medium',
  messageDensity: 'comfortable',
  showTimestamps: true,
  enableSounds: false,
  autoScroll: true,
  enterToSend: true,
};

function App() {
  // Core state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Feature state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);
  const [systemPrompt, setSystemPrompt] = useState('');

  // Panel states
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const { theme, setTheme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const currentMessageRef = useRef<string>('');

  // API functions (defined early so they can be used in hooks)
  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversations?include_archived=${showArchived}`);
      if (response.ok) setConversations(await response.json());
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [showArchived]);

  const handleStopGeneration = useCallback(async () => {
    if (currentConversationId) {
      try {
        await fetch(`/api/conversations/${currentConversationId}/stop`, { method: 'POST' });
        setIsLoading(false);
        setStatus('');
      } catch (err) {
        console.error('Failed to stop generation:', err);
      }
    }
  }, [currentConversationId]);

  const handleNewConversation = useCallback(async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentConversationId(data.id);
        setMessages([]);
        setSystemPrompt('');
        loadConversations();
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  }, [loadConversations]);

  // WebSocket handlers
  const handleWebSocketMessage = useCallback((wsMessage: WebSocketMessage) => {
    switch (wsMessage.type) {
      case 'status':
        setStatus(wsMessage.content as string);
        break;
      case 'token':
        currentMessageRef.current += wsMessage.content as string;
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            lastMessage.content = currentMessageRef.current;
          }
          return newMessages;
        });
        break;
      case 'sources':
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content += wsMessage.content as string;
            lastMessage.sources = wsMessage.content as string;
          }
          return newMessages;
        });
        break;
      case 'debug':
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.debugInfo = wsMessage.content as QueryDebugInfo;
          }
          return newMessages;
        });
        break;
      case 'complete':
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.isStreaming = false;
          }
          return newMessages;
        });
        setIsLoading(false);
        setStatus('');
        currentMessageRef.current = '';
        loadConversations();
        break;
      case 'error':
        setError(wsMessage.content as string);
        setIsLoading(false);
        setStatus('');
        currentMessageRef.current = '';
        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].isStreaming) {
            newMessages.pop();
          }
          return newMessages;
        });
        break;
    }
  }, [loadConversations]);

  const { connect, send } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      setIsConnected(true);
      setError(null);
    },
    onClose: () => setIsConnected(false),
    onError: () => setError('Failed to connect to server'),
  });

  // Effects
  useEffect(() => {
    if (appSettings.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, appSettings.autoScroll]);

  useEffect(() => {
    connect();
    loadTemplates();
    loadSettings();
  }, [connect]);

  useEffect(() => {
    loadConversations();
  }, [showArchived, loadConversations]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            handleNewConversation();
            break;
          case 'k':
            e.preventDefault();
            // Focus sidebar search
            break;
          case 'f':
            e.preventDefault();
            setShowSearch(true);
            break;
          case 's':
            e.preventDefault();
            setShowSettings(true);
            break;
          case 't':
            e.preventDefault();
            setShowTemplates(true);
            break;
          case '/':
            e.preventDefault();
            setShowShortcuts(true);
            break;
          case 'b':
            e.preventDefault();
            setSidebarCollapsed(!sidebarCollapsed);
            break;
          case 'e':
            e.preventDefault();
            if (messages.length > 0) {
              setShowExport(true);
            }
            break;
        }
      }
      if (e.key === 'Escape') {
        if (isLoading) {
          handleStopGeneration();
        }
        setShowSettings(false);
        setShowTemplates(false);
        setShowShortcuts(false);
        setShowSearch(false);
        setShowSystemPrompt(false);
        setShowExport(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarCollapsed, isLoading, messages.length, handleNewConversation, handleStopGeneration]);

  // Scroll detection
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // API calls
  const loadMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(
          data.map((msg: { id: string; role: string; content: string; timestamp: string; is_bookmarked?: boolean; feedback?: number; is_edited?: boolean }) => ({
            id: msg.id || Date.now().toString(),
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.timestamp,
            isBookmarked: msg.is_bookmarked,
            feedback: msg.feedback,
            isEdited: msg.is_edited,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      if (response.ok) setTemplates(await response.json());
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.appSettings) {
          setAppSettings(JSON.parse(data.appSettings));
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/conversations/stats');
      if (response.ok) setStats(await response.json());
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleSelectConversation = async (id: string) => {
    setCurrentConversationId(id);
    await loadMessages(id);
    // Load system prompt for this conversation
    try {
      const response = await fetch(`/api/conversations/${id}/system-prompt`);
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data.system_prompt || '');
      }
    } catch (err) {
      console.error('Failed to load system prompt:', err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      loadConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleRenameConversation = async (id: string, title: string) => {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      loadConversations();
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  };

  const handlePinConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}/pin`, { method: 'POST' });
      loadConversations();
    } catch (err) {
      console.error('Failed to pin conversation:', err);
    }
  };

  const handleArchiveConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}/archive`, { method: 'POST' });
      if (currentConversationId === id && !showArchived) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      loadConversations();
    } catch (err) {
      console.error('Failed to archive conversation:', err);
    }
  };

  const handleUnarchiveConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}/unarchive`, { method: 'POST' });
      loadConversations();
    } catch (err) {
      console.error('Failed to unarchive conversation:', err);
    }
  };

  const handleExportConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}/export`);
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation-${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setError('Failed to export conversation');
    }
  };

  const handleImportConversation = async (data: unknown) => {
    try {
      const response = await fetch('/api/conversations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (response.ok) {
        const result = await response.json();
        loadConversations();
        setCurrentConversationId(result.id);
        await loadMessages(result.id);
      }
    } catch {
      setError('Failed to import conversation');
    }
  };

  const handleClearHistory = async (includePinned: boolean) => {
    try {
      const response = await fetch('/api/conversations/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ include_pinned: includePinned }),
      });
      if (response.ok) {
        const result = await response.json();
        setCurrentConversationId(null);
        setMessages([]);
        loadConversations();
        setStatus(`Cleared ${result.deleted_count} conversations`);
        setTimeout(() => setStatus(''), 3000);
      }
    } catch {
      setError('Failed to clear history');
    }
  };

  // Message actions
  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, content, isEdited: true } : msg))
      );
    } catch {
      setError('Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch {
      setError('Failed to delete message');
    }
  };

  const handleBookmarkMessage = async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}/bookmark`, { method: 'POST' });
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, isBookmarked: !msg.isBookmarked } : msg))
      );
    } catch {
      setError('Failed to bookmark message');
    }
  };

  const handleFeedbackMessage = async (messageId: string, feedback: number) => {
    try {
      await fetch(`/api/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, feedback } : msg)));
    } catch {
      setError('Failed to set feedback');
    }
  };

  const handleRegenerateMessage = async (_messageId: string) => {
    // For regeneration, we need to resend the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage && currentConversationId) {
      sendMessageToServer(currentConversationId, lastUserMessage.content);
    }
  };

  // Templates
  const handleUseTemplate = async (template: Template) => {
    await fetch(`/api/templates/${template.id}/use`, { method: 'POST' });
    setSystemPrompt(template.system_prompt);
    if (template.initial_message) {
      setInputValue(template.initial_message);
    }
    setShowTemplates(false);
  };

  const handleCreateTemplate = async (template: Omit<Template, 'id' | 'created_at' | 'usage_count'>) => {
    try {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      loadTemplates();
    } catch {
      setError('Failed to create template');
    }
  };

  const handleUpdateTemplate = async (id: string, template: Omit<Template, 'id' | 'created_at' | 'usage_count'>) => {
    try {
      await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      loadTemplates();
    } catch {
      setError('Failed to update template');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      loadTemplates();
    } catch {
      setError('Failed to delete template');
    }
  };

  // Settings
  const handleSaveSettings = async (settings: AppSettings) => {
    setAppSettings(settings);
    try {
      await fetch('/api/settings/appSettings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'appSettings', value: JSON.stringify(settings) }),
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  // System prompt
  const handleSaveSystemPrompt = async (prompt: string) => {
    setSystemPrompt(prompt);
    if (currentConversationId) {
      try {
        await fetch(`/api/conversations/${currentConversationId}/system-prompt`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system_prompt: prompt }),
        });
      } catch (err) {
        console.error('Failed to save system prompt:', err);
      }
    }
  };

  const handleJumpToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-primary-500');
      setTimeout(() => element.classList.remove('ring-2', 'ring-primary-500'), 2000);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!currentConversationId) {
      try {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: content.slice(0, 50) }),
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentConversationId(data.id);
          sendMessageToServer(data.id, content);
          loadConversations();
        }
      } catch {
        setError('Failed to create conversation');
      }
    } else {
      sendMessageToServer(currentConversationId, content);
    }
  };

  const sendMessageToServer = (conversationId: string, content: string) => {
    setError(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    setIsLoading(true);
    currentMessageRef.current = '';

    const history = messages.map((msg) => ({ role: msg.role, content: msg.content }));

    const sent = send({
      conversation_id: conversationId,
      content,
      history,
    });

    if (!sent) {
      setError('Not connected to server');
      setIsLoading(false);
      setMessages((prev) => prev.slice(0, -1));
    }
  };

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {!isConnected && (
        <div className="bg-red-500 text-white px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          Disconnected from server. Attempting to reconnect...
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onPinConversation={handlePinConversation}
          onArchiveConversation={handleArchiveConversation}
          onUnarchiveConversation={handleUnarchiveConversation}
          onExportConversation={handleExportConversation}
          onImportConversation={handleImportConversation}
          onClearHistory={handleClearHistory}
          stats={stats}
          onRefreshStats={loadStats}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          showArchived={showArchived}
          onToggleShowArchived={() => setShowArchived(!showArchived)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            theme={theme}
            onThemeChange={setTheme}
            status={status}
            onOpenSettings={() => setShowSettings(true)}
            onOpenTemplates={() => setShowTemplates(true)}
            onOpenShortcuts={() => setShowShortcuts(true)}
            onOpenSearch={() => setShowSearch(true)}
            onOpenSystemPrompt={() => setShowSystemPrompt(true)}
            onOpenExport={() => setShowExport(true)}
            onStopGeneration={handleStopGeneration}
            isGenerating={isLoading}
            hasMessages={messages.length > 0}
          />

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-3 flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-sm underline hover:no-underline">
                Dismiss
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-thin relative" ref={chatContainerRef}>
            {showSearch && (
              <SearchBar
                isOpen={showSearch}
                onClose={() => setShowSearch(false)}
                conversationId={currentConversationId}
                onJumpToMessage={handleJumpToMessage}
              />
            )}

            {messages.length === 0 ? (
              <div className="h-full flex flex-col">
                <EmptyState />
                <div className="max-w-4xl mx-auto w-full px-4 pb-4">
                  <QuickActions onSelectPrompt={setInputValue} />
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    onRegenerate={handleRegenerateMessage}
                    onFeedback={handleFeedbackMessage}
                    onBookmark={handleBookmarkMessage}
                    showTimestamps={appSettings.showTimestamps}
                    density={appSettings.messageDensity}
                    fontSize={appSettings.fontSize}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            <ScrollToBottom show={showScrollButton} onClick={handleScrollToBottom} />
          </div>

          <ChatInput
            onSend={(content) => {
              handleSendMessage(content);
              setInputValue('');
            }}
            disabled={!isConnected}
            isLoading={isLoading}
            value={inputValue}
            onChange={setInputValue}
            enterToSend={appSettings.enterToSend}
          />
        </div>
      </div>

      {/* Modals */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={appSettings}
        onSave={handleSaveSettings}
      />

      <TemplatesPanel
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        templates={templates}
        onUseTemplate={handleUseTemplate}
        onCreateTemplate={handleCreateTemplate}
        onUpdateTemplate={handleUpdateTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />

      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <SystemPromptEditor
        isOpen={showSystemPrompt}
        onClose={() => setShowSystemPrompt(false)}
        systemPrompt={systemPrompt}
        onSave={handleSaveSystemPrompt}
      />

      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        messages={messages}
        conversationTitle={
          conversations.find((c) => c.id === currentConversationId)?.title || 'Conversation'
        }
      />
    </div>
  );
}

export default App;
