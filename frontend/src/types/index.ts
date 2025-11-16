export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  sources?: string;
  debugInfo?: QueryDebugInfo;
  isBookmarked?: boolean;
  feedback?: number;
  isEdited?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  preview: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  message_count: number;
}

export interface ConversationStats {
  total_conversations: number;
  active_conversations: number;
  archived_conversations: number;
  pinned_conversations: number;
  total_messages: number;
  average_messages_per_conversation: number;
  oldest_conversation: string | null;
  most_recent_activity: string | null;
}

export interface ExportedConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  is_archived: boolean;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
  }>;
  exported_at: string;
}

export interface QueryDebugInfo {
  original_query: string;
  expanded_queries: string[];
  cql_query: string;
  pages_searched: number;
  total_chunks_considered: number;
  chunks_selected: number;
  context_chars_used: number;
  context_budget: number;
  top_k: number;
  mmr_lambda: number;
  max_chunks_per_page: number;
  selected_chunks_info: ChunkInfo[];
}

export interface ChunkInfo {
  page_title: string;
  page_url: string;
  similarity: number;
}

export interface WebSocketMessage {
  type: 'token' | 'sources' | 'debug' | 'complete' | 'error' | 'status';
  content: string | QueryDebugInfo;
}

export type Theme = 'light' | 'dark' | 'system';

export type DateGroup = 'pinned' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'older';

export interface Template {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  initial_message: string;
  created_at: string;
  usage_count: number;
}

export interface AppSettings {
  fontSize: 'small' | 'medium' | 'large';
  messageDensity: 'compact' | 'comfortable' | 'spacious';
  showTimestamps: boolean;
  enableSounds: boolean;
  autoScroll: boolean;
  enterToSend: boolean;
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: string;
}
