import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import type { Credentials } from '../types';
import { validateIntercomCredentials, validateOpenAICredentials, configureAPIs } from '../services/api';
import { initDB } from '../services/db';
import { useNavigate } from 'react-router-dom';

interface Props {
  isOpen: boolean;
  onSuccess: () => void;
}

export default function APICredentialsModal({ isOpen, onSuccess }: Props) {
  const [credentials, setCredentials] = useState<Credentials>({
    OPENAI_API_KEY: '',
    OPENAI_ORGANIZATION_ID: '',
    INTERCOM_ACCESS_TOKEN: '',
    INTERCOM_BASE_URL: 'https://api.intercom.io/',
    DATABASE_NAME: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [testResults, setTestResults] = useState<{
    local: boolean | null;
    intercom: boolean | null;
    openai: boolean | null;
  }>({
    local: null,
    intercom: null,
    openai: null,
  });

  const navigate = useNavigate();

  // Load existing credentials from localStorage when the modal opens
  useEffect(() => {
    if (isOpen) {
      const storedCredentials = localStorage.getItem('credentials');
      if (storedCredentials) {
        try {
          const parsedCredentials = JSON.parse(storedCredentials) as Credentials;
          setCredentials(parsedCredentials);
        } catch (error) {
          console.error('Failed to parse stored credentials:', error);
        }
      }
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsValidating(true);

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
      console.log('Saving credentials to localStorage:', credentials);
      localStorage.setItem('credentials', JSON.stringify(credentials));
      console.log('Credentials saved to localStorage');

      onSuccess();
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(err instanceof Error ? err.message : 'Failed to validate credentials');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={() => navigate('/')}
      className="relative z-10"
    >
      <div className="fixed inset-0 bg-black bg-opacity-25" />

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <div className="flex justify-between items-center">
              <Dialog.Title
                as="h3"
                className="text-lg font-medium leading-6 text-gray-900"
              >
                API Credentials
              </Dialog.Title>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500"
                onClick={() => navigate('/')}
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-6">
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
                      onChange={handleChange}
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
                    onChange={handleChange}
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
                      onChange={handleChange}
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
                      onChange={handleChange}
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
                    onChange={handleChange}
                  />
                </div>
                {testResults.openai !== null && (
                  <div className={`text-sm mt-1 ${testResults.openai ? 'text-green-600' : 'text-red-600'}`}>
                    {testResults.openai ? '✓ OpenAI credentials are valid' : '✗ OpenAI credentials are invalid'}
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-600 font-medium">{error}</p>
                </div>
              )}

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isValidating}
                  className="btn btn-primary w-full"
                >
                  {isValidating ? 'Validating...' : 'Save Credentials'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
} 