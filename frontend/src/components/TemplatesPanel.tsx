import { useState } from 'react';
import { X, Plus, Edit3, Trash2, Play, FileText } from 'lucide-react';
import { Template } from '../types';

interface TemplatesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  onUseTemplate: (template: Template) => void;
  onCreateTemplate: (template: Omit<Template, 'id' | 'created_at' | 'usage_count'>) => void;
  onUpdateTemplate: (id: string, template: Omit<Template, 'id' | 'created_at' | 'usage_count'>) => void;
  onDeleteTemplate: (id: string) => void;
}

export function TemplatesPanel({
  isOpen,
  onClose,
  templates,
  onUseTemplate,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
}: TemplatesPanelProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    initial_message: '',
  });

  if (!isOpen) return null;

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      system_prompt: template.system_prompt,
      initial_message: template.initial_message,
    });
    setShowEditor(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      system_prompt: '',
      initial_message: '',
    });
    setShowEditor(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, formData);
    } else {
      onCreateTemplate(formData);
    }
    setShowEditor(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            {showEditor ? (editingTemplate ? 'Edit Template' : 'New Template') : 'Conversation Templates'}
          </h2>
          <button
            onClick={showEditor ? () => setShowEditor(false) : onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showEditor ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="Template name..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="Brief description..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">System Prompt</label>
              <textarea
                value={formData.system_prompt}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                placeholder="Custom system prompt for this template..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Initial Message (optional)</label>
              <textarea
                value={formData.initial_message}
                onChange={(e) => setFormData({ ...formData, initial_message: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                placeholder="First message to start the conversation..."
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No templates yet</p>
                <p className="text-sm mt-1">Create templates to quickly start conversations with predefined prompts</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium">{template.name}</h3>
                        {template.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{template.description}</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                          Used {template.usage_count} times
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onUseTemplate(template)}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                          title="Use template"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(template)}
                          className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this template?')) {
                              onDeleteTemplate(template.id);
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {template.system_prompt && (
                      <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono line-clamp-3">
                        {template.system_prompt}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          {showEditor ? (
            <>
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium"
              >
                {editingTemplate ? 'Update' : 'Create'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Close
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Template
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
