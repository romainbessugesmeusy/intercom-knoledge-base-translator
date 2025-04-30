import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import type { LanguageInstructions } from '../types';
import { saveLanguageInstructions, getLanguageInstructions } from '../services/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  languageCode: string;
}

export default function LanguageInstructionsModal({ isOpen, onClose, languageCode }: Props) {
  const [instructions, setInstructions] = useState<LanguageInstructions>({
    languageCode,
    writingInstructions: '',
    glossary: {},
  });

  const [glossaryKey, setGlossaryKey] = useState('');
  const [glossaryValue, setGlossaryValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadInstructions = async () => {
      const saved = await getLanguageInstructions(languageCode);
      if (saved) {
        setInstructions(saved);
      }
    };

    if (isOpen) {
      loadInstructions();
    }
  }, [isOpen, languageCode]);

  const handleAddGlossaryItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (glossaryKey && glossaryValue) {
      setInstructions(prev => ({
        ...prev,
        glossary: {
          ...prev.glossary,
          [glossaryKey]: glossaryValue,
        },
      }));
      setGlossaryKey('');
      setGlossaryValue('');
    }
  };

  const handleRemoveGlossaryItem = (key: string) => {
    setInstructions(prev => {
      const { [key]: omitted, ...rest } = prev.glossary; // eslint-disable-line @typescript-eslint/no-unused-vars
      return {
        ...prev,
        glossary: rest,
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveLanguageInstructions(instructions);
      onClose();
    } catch (error) {
      console.error('Failed to save instructions:', error);
    } finally {
      setIsSaving(false);
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
              Translation Instructions for <code className="font-mono">{languageCode}</code>
            </Dialog.Title>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Writing Instructions
              </label>
              <textarea
                className="input mt-1 h-32"
                value={instructions.writingInstructions}
                onChange={(e) => setInstructions(prev => ({
                  ...prev,
                  writingInstructions: e.target.value,
                }))}
                placeholder="Enter specific instructions for translating content into this language..."
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700">
                Glossary
              </label>
              
              <form onSubmit={handleAddGlossaryItem} className="mt-2 flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Term"
                  value={glossaryKey}
                  onChange={(e) => setGlossaryKey(e.target.value)}
                />
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Translation"
                  value={glossaryValue}
                  onChange={(e) => setGlossaryValue(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={!glossaryKey || !glossaryValue}
                >
                  Add
                </button>
              </form>

              <div className="mt-4 max-h-48 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Term
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Translation
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(instructions.glossary).map(([key, value]) => (
                      <tr key={key}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {key}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {value}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleRemoveGlossaryItem(key)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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