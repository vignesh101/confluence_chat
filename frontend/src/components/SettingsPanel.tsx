import { useState } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const defaultSettings: AppSettings = {
  fontSize: 'medium',
  messageDensity: 'comfortable',
  showTimestamps: true,
  enableSounds: false,
  autoScroll: true,
  enterToSend: true,
};

export function SettingsPanel({ isOpen, onClose, settings, onSave }: SettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(defaultSettings);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium mb-2">Font Size</label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setLocalSettings({ ...localSettings, fontSize: size })}
                  className={`flex-1 py-2 px-4 rounded-lg border text-sm capitalize ${
                    localSettings.fontSize === size
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Message Density */}
          <div>
            <label className="block text-sm font-medium mb-2">Message Density</label>
            <div className="flex gap-2">
              {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                <button
                  key={density}
                  onClick={() => setLocalSettings({ ...localSettings, messageDensity: density })}
                  className={`flex-1 py-2 px-4 rounded-lg border text-sm capitalize ${
                    localSettings.messageDensity === density
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {density}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Options */}
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm">Show timestamps</span>
              <input
                type="checkbox"
                checked={localSettings.showTimestamps}
                onChange={(e) => setLocalSettings({ ...localSettings, showTimestamps: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm">Enable sounds</span>
              <input
                type="checkbox"
                checked={localSettings.enableSounds}
                onChange={(e) => setLocalSettings({ ...localSettings, enableSounds: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm">Auto-scroll to new messages</span>
              <input
                type="checkbox"
                checked={localSettings.autoScroll}
                onChange={(e) => setLocalSettings({ ...localSettings, autoScroll: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm">Press Enter to send (Shift+Enter for new line)</span>
              <input
                type="checkbox"
                checked={localSettings.enterToSend}
                onChange={(e) => setLocalSettings({ ...localSettings, enterToSend: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
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
