import { Dialog } from '@headlessui/react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { IntercomArticle } from '../types';
import { getLanguageName } from '../data/languages';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  article: IntercomArticle;
  onTranslate: (article: IntercomArticle) => void;
  onRefresh: () => Promise<void>;
}

export default function ArticleViewerModal({
  isOpen,
  onClose,
  article,
  onTranslate,
  onRefresh,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const selectedTranslation = searchParams.get('translation') || article.default_locale;

  const handleClose = () => {
    onClose();
  };

  const handleTranslationClick = (lang: string) => {
    const newSearchParams = new URLSearchParams(location.search);
    newSearchParams.set('translation', lang);
    navigate(`${location.pathname}?${newSearchParams.toString()}`);
  };

  const getContent = () => {
    if (selectedTranslation === article.default_locale) {
      return article.body;
    }
    const translation = article.translated_content[selectedTranslation];
    return translation ? translation.body : article.body;
  };

  const getTitle = () => {
    if (selectedTranslation === article.default_locale) {
      return article.title;
    }
    const translation = article.translated_content[selectedTranslation];
    return translation ? translation.title : article.title;
  };

  const getDescription = () => {
    if (selectedTranslation === article.default_locale) {
      return article.description;
    }
    const translation = article.translated_content[selectedTranslation];
    return translation ? translation.description : article.description;
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <div className="flex justify-between items-start">
              <div>
                <Dialog.Title className="text-2xl font-semibold text-gray-900">
                  {getTitle()}
                </Dialog.Title>
                <p className="mt-1 text-sm text-gray-500">
                  {getDescription()}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={onRefresh}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
                >
                  Refresh
                </button>
                <button
                  onClick={() => {
                    onTranslate(article)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
                >
                  Translate
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-6">
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Created:</span>{' '}
                  {new Date(article.created_at * 1000).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Updated:</span>{' '}
                  {new Date(article.updated_at * 1000).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium text-gray-700">State:</span>{' '}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    article.state === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {article.state}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Default Locale:</span>{' '}
                  {article.default_locale}
                </div>
              </div>
              
              {Object.keys(article.translated_content).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Available Translations
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleTranslationClick(article.default_locale)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedTranslation === article.default_locale
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      }`}
                    >
                      {getLanguageName(article.default_locale)} (original)
                    </button>
                    {Object.entries(article.translated_content).filter(([lang]) => lang !== "type").map(([lang, content]) => (
                      <button
                        key={lang}
                        onClick={() => handleTranslationClick(lang)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedTranslation === lang
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                      >
                        {getLanguageName(lang)} ({content.state})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Content</h4>
                <div
                  className="prose max-w-none border rounded-lg p-4 bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: getContent() }}
                />
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
} 