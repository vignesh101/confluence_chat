import { useState } from 'react';
import { X, Download, FileText, Code, File } from 'lucide-react';
import { Message } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  conversationTitle: string;
}

type ExportFormat = 'markdown' | 'html' | 'json' | 'text';

export function ExportModal({ isOpen, onClose, messages, conversationTitle }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeDebugInfo, setIncludeDebugInfo] = useState(false);

  if (!isOpen) return null;

  const exportToMarkdown = (): string => {
    let content = `# ${conversationTitle}\n\n`;
    content += `Exported on ${new Date().toLocaleString()}\n\n---\n\n`;

    messages.forEach((msg) => {
      const role = msg.role === 'user' ? '**You**' : '**Assistant**';
      if (includeTimestamps) {
        content += `### ${role} - ${new Date(msg.timestamp).toLocaleString()}\n\n`;
      } else {
        content += `### ${role}\n\n`;
      }
      content += `${msg.content}\n\n`;

      if (includeDebugInfo && msg.debugInfo) {
        content += `<details>\n<summary>Query Details</summary>\n\n`;
        content += `- Original Query: ${msg.debugInfo.original_query}\n`;
        content += `- Pages Searched: ${msg.debugInfo.pages_searched}\n`;
        content += `- Chunks Selected: ${msg.debugInfo.chunks_selected}\n`;
        if (msg.debugInfo.expanded_queries.length > 0) {
          content += `- Expanded Queries:\n`;
          msg.debugInfo.expanded_queries.forEach((q) => {
            content += `  - ${q}\n`;
          });
        }
        content += `\n</details>\n\n`;
      }

      content += `---\n\n`;
    });

    return content;
  };

  const exportToHTML = (): string => {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${conversationTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
    }
    .message {
      margin-bottom: 20px;
      padding: 15px;
      border-radius: 8px;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .user {
      border-left: 4px solid #3b82f6;
    }
    .assistant {
      border-left: 4px solid #10b981;
    }
    .role {
      font-weight: bold;
      margin-bottom: 8px;
    }
    .timestamp {
      font-size: 12px;
      color: #666;
    }
    .content {
      white-space: pre-wrap;
      line-height: 1.6;
    }
    .debug {
      margin-top: 10px;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 4px;
      font-size: 12px;
    }
    h1 {
      color: #1f2937;
    }
    .export-info {
      color: #666;
      font-size: 14px;
      margin-bottom: 20px;
    }
    pre {
      background: #1f2937;
      color: #e5e7eb;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
    }
    code {
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>${conversationTitle}</h1>
  <p class="export-info">Exported on ${new Date().toLocaleString()}</p>
`;

    messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'You' : 'Assistant';
      const roleClass = msg.role === 'user' ? 'user' : 'assistant';

      html += `  <div class="message ${roleClass}">
    <div class="role">${role}${
        includeTimestamps
          ? ` <span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span>`
          : ''
      }</div>
    <div class="content">${escapeHtml(msg.content)}</div>`;

      if (includeDebugInfo && msg.debugInfo) {
        html += `
    <div class="debug">
      <strong>Query Details:</strong><br>
      Original Query: ${escapeHtml(msg.debugInfo.original_query)}<br>
      Pages Searched: ${msg.debugInfo.pages_searched}<br>
      Chunks Selected: ${msg.debugInfo.chunks_selected}
      ${
        msg.debugInfo.expanded_queries.length > 0
          ? `<br>Expanded Queries: ${msg.debugInfo.expanded_queries.map(escapeHtml).join(', ')}`
          : ''
      }
    </div>`;
      }

      html += `
  </div>
`;
    });

    html += `</body>
</html>`;

    return html;
  };

  const exportToJSON = (): string => {
    const data = {
      title: conversationTitle,
      exportedAt: new Date().toISOString(),
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        ...(includeDebugInfo && msg.debugInfo ? { debugInfo: msg.debugInfo } : {}),
      })),
    };
    return JSON.stringify(data, null, 2);
  };

  const exportToText = (): string => {
    let content = `${conversationTitle}\n`;
    content += `${'='.repeat(conversationTitle.length)}\n\n`;
    content += `Exported on ${new Date().toLocaleString()}\n\n`;

    messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'You' : 'Assistant';
      if (includeTimestamps) {
        content += `[${new Date(msg.timestamp).toLocaleString()}] ${role}:\n`;
      } else {
        content += `${role}:\n`;
      }
      content += `${msg.content}\n\n`;
      content += `${'-'.repeat(40)}\n\n`;
    });

    return content;
  };

  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const handleExport = () => {
    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'markdown':
        content = exportToMarkdown();
        mimeType = 'text/markdown';
        extension = 'md';
        break;
      case 'html':
        content = exportToHTML();
        mimeType = 'text/html';
        extension = 'html';
        break;
      case 'json':
        content = exportToJSON();
        mimeType = 'application/json';
        extension = 'json';
        break;
      case 'text':
      default:
        content = exportToText();
        mimeType = 'text/plain';
        extension = 'txt';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversationTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onClose();
  };

  const formatOptions = [
    {
      value: 'markdown' as ExportFormat,
      label: 'Markdown',
      icon: <FileText className="w-5 h-5" />,
      description: 'Best for documentation and GitHub',
    },
    {
      value: 'html' as ExportFormat,
      label: 'HTML',
      icon: <Code className="w-5 h-5" />,
      description: 'Viewable in any browser',
    },
    {
      value: 'json' as ExportFormat,
      label: 'JSON',
      icon: <File className="w-5 h-5" />,
      description: 'Machine-readable format',
    },
    {
      value: 'text' as ExportFormat,
      label: 'Plain Text',
      icon: <FileText className="w-5 h-5" />,
      description: 'Simple text format',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Export Conversation</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Export Format</label>
            <div className="grid grid-cols-2 gap-3">
              {formatOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormat(option.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    format === option.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div
                    className={
                      format === option.value
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-500'
                    }
                  >
                    {option.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium">Options</label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeTimestamps}
                onChange={(e) => setIncludeTimestamps(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm">Include timestamps</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeDebugInfo}
                onChange={(e) => setIncludeDebugInfo(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm">Include query debug information</span>
            </label>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Preview:</strong>
              <div className="mt-1">
                • {messages.length} message{messages.length !== 1 ? 's' : ''} will be exported
                <br />• File format: {formatOptions.find((f) => f.value === format)?.label}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={messages.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
