import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import type { GlobalConfig } from '../types';
import { saveGlobalConfig, getGlobalConfig } from '../services/db';
import { openaiApi } from '../services/api';
import { SettingsService } from '../services/settings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  languageCodes: string[];
  onLanguageCodesChange: (codes: string[]) => void;
}

interface OpenAIModel {
  id: string;
  created: number;
  owned_by: string;
}

export default function GlobalSettingsModal({ isOpen, onClose, languageCodes, onLanguageCodesChange }: Props) {
  const [config, setConfig] = useState<GlobalConfig>({
    instructions: '',
    openaiModel: 'gpt-4',
  });
  const [newCode, setNewCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [availableModels, setAvailableModels] = useState<OpenAIModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const saved = await getGlobalConfig();
      if (saved) {
        setConfig(saved);
      }
    };

    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const response = await openaiApi.get<{ data: OpenAIModel[] }>('/models');
        setAvailableModels(response.data.data.filter(model => 
          model.id.startsWith('gpt-') && !model.id.includes('instruct')
        ));
      } catch (error) {
        console.error('Failed to load OpenAI models:', error);
      } finally {
        setIsLoadingModels(false);
      }
    };

    if (isOpen) {
      loadConfig();
      loadModels();
    }
  }, [isOpen]);

  const handleAddCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode) return;

    // Validation for both two-letter language codes and language-region format
    const codeRegex = /^[a-z]{2}(-[A-Z]{2})?$/;
    if (!codeRegex.test(newCode)) {
      setError('Language code must be in format: xx or xx-XX (e.g., fr or fr-FR)');
      return;
    }

    if (languageCodes.includes(newCode)) {
      setError('This language code already exists');
      return;
    }

    onLanguageCodesChange([...languageCodes, newCode]);
    setNewCode('');
    setError(null);
  };

  const handleRemoveCode = (codeToRemove: string) => {
    onLanguageCodesChange(languageCodes.filter(code => code !== codeToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveGlobalConfig(config);
      onClose();
    } catch (error) {
      console.error('Failed to save global config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      setError(null);
      setSuccess(null);
      await SettingsService.exportSettings();
      setSuccess('Settings exported successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export settings');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      setSuccess(null);
      await SettingsService.importSettings(file);
      setSuccess('Settings imported successfully');
      // Reset the file input
      event.target.value = '';
      // Reload the page to apply the imported settings
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import settings');
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-10"
    >
      <div className="fixed inset-0 bg-black bg-opacity-25" />

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <Dialog.Title
              as="h3"
              className="text-lg font-medium leading-6 text-gray-900"
            >
              Global Settings
            </Dialog.Title>

            <div className="mt-6 space-y-6">
              {/* Import/Export Section */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-4">Import/Export Settings</h4>
                <div className="flex space-x-4">
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Export Settings
                  </button>
                  <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors cursor-pointer">
                    Import Settings
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </div>
                {error && (
                  <div className="mt-2 p-3 bg-red-50 text-red-700 rounded">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mt-2 p-3 bg-green-50 text-green-700 rounded">
                    {success}
                  </div>
                )}
              </div>

              {/* OpenAI Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  OpenAI Model
                </label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={config.openaiModel}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    openaiModel: e.target.value,
                  }))}
                  disabled={isLoadingModels}
                >
                  {isLoadingModels ? (
                    <option>Loading models...</option>
                  ) : (
                    availableModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.id}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Global Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Global Instructions
                </label>
                <textarea
                  className="input mt-1 h-32"
                  value={config.instructions}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    instructions: e.target.value,
                  }))}
                  placeholder="Enter global instructions that apply to all translations..."
                />
              </div>

              {/* Language Codes Management */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Manage Languages
                </label>
                <form onSubmit={handleAddCode} className="mt-2 flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Add language code (e.g., fr or fr-FR)"
                    value={newCode}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Convert only the language part to lowercase, preserve the region part
                      const parts = value.split('-');
                      const newValue = parts.length > 1 
                        ? `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`
                        : value.toLowerCase();
                      setNewCode(newValue);
                      setError(null);
                    }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!newCode}
                  >
                    Add
                  </button>
                </form>

                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}

                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Current Language Codes</h4>
                  <div className="max-h-48 overflow-y-auto">
                    <ul className="divide-y divide-gray-200">
                      {languageCodes.map((code) => (
                        <li key={code} className="py-2 flex justify-between items-center">
                          <code className="font-mono">{code}</code>
                          <button
                            onClick={() => handleRemoveCode(code)}
                            className="text-red-600 hover:text-red-900 text-sm"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
} 