import { MessageSquare, Zap, Shield, Search } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-10 h-10 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Welcome to Confluence Chat</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Ask questions about your Confluence content and get intelligent, context-aware answers
          with source citations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-3">
              <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold mb-1">Smart Search</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Semantic search across all your Confluence pages
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold mb-1">Instant Answers</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get immediate responses with relevant context
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-3">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold mb-1">Source Citations</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Every answer includes links to source pages
            </p>
          </div>
        </div>

        <div className="mt-8 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 p-6 rounded-xl">
          <h3 className="font-semibold mb-2">Example Questions</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>"How do I set up the development environment?"</li>
            <li>"What are the deployment procedures?"</li>
            <li>"Explain the authentication flow"</li>
            <li>"What are the API rate limits?"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
