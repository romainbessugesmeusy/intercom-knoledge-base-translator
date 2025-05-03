import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import type { GlobalConfig, Credentials } from '../types';
import { saveGlobalConfig, getGlobalConfig } from '../services/db';
import { openaiApi, validateIntercomCredentials, validateOpenAICredentials, configureAPIs } from '../services/api';
import { SettingsService } from '../services/settings';
import { initDB } from '../services/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCredentialsSuccess?: () => void;
}

interface OpenAIModel {
  id: string;
  created: number;
  owned_by: string;
}

export default function GlobalSettingsModal({ isOpen, onClose, onCredentialsSuccess }: Props) {
  // Global Settings State
  const [config, setConfig] = useState<GlobalConfig>({
    instructions: '',
    openaiModel: 'gpt-4',
    maxConcurrentTranslations: 3,
  });

  // API Credentials State
  const [credentials, setCredentials] = useState<Credentials>({
    OPENAI_API_KEY: '',
    OPENAI_ORGANIZATION_ID: '',
    INTERCOM_ACCESS_TOKEN: '',
    INTERCOM_BASE_URL: 'https://api.intercom.io/',
    DATABASE_NAME: '',
  });

  // UI State
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [availableModels, setAvailableModels] = useState<OpenAIModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [activeTab, setActiveTab] = useState<'credentials' | 'settings'>('credentials');
  const [testResults, setTestResults] = useState<{
    local: boolean | null;
    intercom: boolean | null;
    openai: boolean | null;
  }>({
    local: null,
    intercom: null,
    openai: null,
  });

  useEffect(() => {
    if (isOpen) {
      // Load Global Config
      const loadConfig = async () => {
        const saved = await getGlobalConfig();
        if (saved) {
          setConfig(saved);
        }
      };

      // Load OpenAI Models
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

      // Load Credentials
      const loadCredentials = () => {
        const storedCredentials = localStorage.getItem('credentials');
        if (storedCredentials) {
          try {
            const parsedCredentials = JSON.parse(storedCredentials) as Credentials;
            setCredentials(parsedCredentials);
          } catch (error) {
            console.error('Failed to parse stored credentials:', error);
          }
        }
      };

      loadConfig();
      loadModels();
      loadCredentials();
    }
  }, [isOpen]);

  // Credentials Handlers
  const handleCredentialsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const testLocalConfig = async () => {
    try {
      await initDB(credentials.DATABASE_NAME);
      setTestResults(prev => ({ ...prev, local: true }));
    } catch (error) {
      console.error('Local configuration test failed:', error);
      setTestResults(prev => ({ ...prev, local: false }));
    }
  };

  const testIntercomConfig = async () => {
    try {
      configureAPIs(credentials);
      const isValid = await validateIntercomCredentials();
      setTestResults(prev => ({ ...prev, intercom: isValid }));
    } catch (error) {
      console.error('Intercom configuration test failed:', error);
      setTestResults(prev => ({ ...prev, intercom: false }));
    }
  };

  const testOpenAIConfig = async () => {
    try {
      configureAPIs(credentials);
      const isValid = await validateOpenAICredentials();
      setTestResults(prev => ({ ...prev, openai: isValid }));
    } catch (error) {
      console.error('OpenAI configuration test failed:', error);
      setTestResults(prev => ({ ...prev, openai: false }));
    }
  };

  const handleCredentialsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      // Configure APIs with credentials
      configureAPIs(credentials);

      // Validate credentials
      const [intercomValid, openaiValid] = await Promise.all([
        validateIntercomCredentials(),
        validateOpenAICredentials(),
      ]);

      if (!intercomValid) {
        throw new Error('Invalid Intercom credentials');
      }

      if (!openaiValid) {
        throw new Error('Invalid OpenAI credentials');
      }

      // Initialize IndexedDB
      await initDB(credentials.DATABASE_NAME);

      // Store credentials in localStorage
      localStorage.setItem('credentials', JSON.stringify(credentials));
      
      setSuccess('Credentials saved successfully');
      if (onCredentialsSuccess) {
        onCredentialsSuccess();
      }
      
      // Close the modal to show the download progress
      onClose();
    } catch (err) {
      console.error('Error saving credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to validate credentials');
    } finally {
      setIsSaving(false);
    }
  };

  // Global Settings Handlers
  const handleSettingsSave = async () => {
    setIsSaving(true);
    try {
      await saveGlobalConfig(config);
      setSuccess('Settings saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save global config:', error);
      setError('Failed to save settings');
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
      event.target.value = '';
      
      // Reload the config
      const saved = await getGlobalConfig();
      if (saved) {
        setConfig(saved);
      }
      
      // Reload credentials
      const storedCredentials = localStorage.getItem('credentials');
      if (storedCredentials) {
        setCredentials(JSON.parse(storedCredentials));
      }
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
            <div className="flex justify-between items-center">
              <Dialog.Title
                as="h3"
                className="text-lg font-medium leading-6 text-gray-900"
              >
                Global Settings
              </Dialog.Title>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500"
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mt-4">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('credentials')}
                  className={`${
                    activeTab === 'credentials'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  API Credentials
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`${
                    activeTab === 'settings'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Settings
                </button>
              </nav>
            </div>

            {/* Status Messages */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-4 p-4 bg-green-50 text-green-700 rounded">
                {success}
              </div>
            )}

            {/* API Credentials Tab */}
            {activeTab === 'credentials' && (
              <form onSubmit={handleCredentialsSave} className="mt-4 space-y-6">
                {/* Local Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">Local Configuration</h4>
                  <div>
                    <label htmlFor="DATABASE_NAME" className="block text-sm font-medium text-gray-700">
                      Database Name
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        name="DATABASE_NAME"
                        id="DATABASE_NAME"
                        required
                        className="input flex-1"
                        value={credentials.DATABASE_NAME}
                        onChange={handleCredentialsChange}
                      />
                      <button
                        type="button"
                        onClick={testLocalConfig}
                        className="btn btn-secondary"
                      >
                        Test
                      </button>
                    </div>
                    {testResults.local !== null && (
                      <div className={`text-sm mt-1 ${testResults.local ? 'text-green-600' : 'text-red-600'}`}>
                        {testResults.local ? '✓ Local configuration is valid' : '✗ Local configuration is invalid'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Intercom Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">Intercom Configuration</h4>
                  <div>
                    <label htmlFor="INTERCOM_BASE_URL" className="block text-sm font-medium text-gray-700">
                      Intercom API Server
                    </label>
                    <select
                      name="INTERCOM_BASE_URL"
                      id="INTERCOM_BASE_URL"
                      required
                      className="input mt-1"
                      value={credentials.INTERCOM_BASE_URL}
                      onChange={handleCredentialsChange}
                    >
                      <option value="https://api.intercom.io/">Production API Server</option>
                      <option value="https://api.eu.intercom.io/">European API Server</option>
                      <option value="https://api.au.intercom.io/">Australian API Server</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="INTERCOM_ACCESS_TOKEN" className="block text-sm font-medium text-gray-700">
                      Intercom Access Token
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="password"
                        name="INTERCOM_ACCESS_TOKEN"
                        id="INTERCOM_ACCESS_TOKEN"
                        required
                        className="input flex-1"
                        value={credentials.INTERCOM_ACCESS_TOKEN}
                        onChange={handleCredentialsChange}
                      />
                      <button
                        type="button"
                        onClick={testIntercomConfig}
                        className="btn btn-secondary"
                      >
                        Test
                      </button>
                    </div>
                    {testResults.intercom !== null && (
                      <div className={`text-sm mt-1 ${testResults.intercom ? 'text-green-600' : 'text-red-600'}`}>
                        {testResults.intercom ? '✓ Intercom credentials are valid' : '✗ Intercom credentials are invalid'}
                      </div>
                    )}
                  </div>
                </div>

                {/* OpenAI Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">OpenAI Configuration</h4>
                  <div>
                    <label htmlFor="OPENAI_API_KEY" className="block text-sm font-medium text-gray-700">
                      OpenAI API Key
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="password"
                        name="OPENAI_API_KEY"
                        id="OPENAI_API_KEY"
                        required
                        className="input flex-1"
                        value={credentials.OPENAI_API_KEY}
                        onChange={handleCredentialsChange}
                      />
                      <button
                        type="button"
                        onClick={testOpenAIConfig}
                        className="btn btn-secondary"
                      >
                        Test
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="OPENAI_ORGANIZATION_ID" className="block text-sm font-medium text-gray-700">
                      OpenAI Organization ID
                    </label>
                    <input
                      type="text"
                      name="OPENAI_ORGANIZATION_ID"
                      id="OPENAI_ORGANIZATION_ID"
                      required
                      className="input mt-1"
                      value={credentials.OPENAI_ORGANIZATION_ID}
                      onChange={handleCredentialsChange}
                    />
                  </div>
                  {testResults.openai !== null && (
                    <div className={`text-sm mt-1 ${testResults.openai ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults.openai ? '✓ OpenAI credentials are valid' : '✗ OpenAI credentials are invalid'}
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn btn-primary w-full"
                  >
                    {isSaving ? 'Saving...' : 'Save Credentials'}
                  </button>
                </div>
              </form>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
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

                {/* Max Concurrent Translations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Concurrent Translations
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={config.maxConcurrentTranslations}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      maxConcurrentTranslations: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)),
                    }))}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Maximum number of translations to process simultaneously (1-10)
                  </p>
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
                    onClick={handleSettingsSave}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
} 