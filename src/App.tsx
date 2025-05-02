import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import APICredentialsModal from './components/APICredentialsModal'
import LanguageInstructionsModal from './components/LanguageInstructionsModal'
import GlobalSettingsModal from './components/GlobalSettingsModal'
import ArticleList from './components/ArticleList'
import ArticleViewerModal from './components/ArticleViewerModal'
import TranslatePopup from './components/TranslatePopup'
import { fetchIntercomArticles, configureAPIs } from './services/api'
import { initDB, saveArticle, getAllArticles, getTranslationBatch } from './services/db'
import type { IntercomArticle, Credentials, TranslationBatch } from './types'
import { translationManager } from './services/TranslationManager'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // State
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingFetched, setLoadingFetched] = useState(0)
  const [loadingTotal, setLoadingTotal] = useState<number|null>(null)
  const [articles, setArticles] = useState<IntercomArticle[]>([])
  const [selectedLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage')
    return savedLanguage || 'fr-FR'
  })
  const [languageCodes, setLanguageCodes] = useState<string[]>(() => {
    const savedCodes = localStorage.getItem('languageCodes')
    return savedCodes ? JSON.parse(savedCodes) : ['fr-FR', 'en-US', 'es-ES', 'de-DE', 'it-IT', 'pt-BR']
  })
  const [selectedArticle, setSelectedArticle] = useState<IntercomArticle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentBatch, setCurrentBatch] = useState<TranslationBatch | null>(null)
  const [dbName, setDbName] = useState<string>(() => {
    const storedCredentials = localStorage.getItem('credentials')
    return storedCredentials ? JSON.parse(storedCredentials).DATABASE_NAME : ''
  })

  // Detect if the current route is a modal route
  const isModal = location.pathname.startsWith('/translations/')

  // Load the batch for the modal if needed
  useEffect(() => {
    let cancelled = false;
    async function loadBatch() {
      if (isModal && dbName) {  // Only proceed if we have a dbName
        const batchId = location.pathname.split('/translations/')[1]
        try {
          await initDB(dbName)
          if (cancelled) return;
          const batch = await getTranslationBatch(batchId);
          if (!cancelled) setCurrentBatch(batch || null);
        } catch (error) {
          console.error('Failed to load batch:', error);
          if (!cancelled) setError('Failed to load translation batch');
        }
      } else {
        setCurrentBatch(null);
      }
    }
    loadBatch();
    return () => { cancelled = true; };
  }, [isModal, location.pathname, dbName])

  // Save language codes to localStorage when they change
  useEffect(() => {
    localStorage.setItem('languageCodes', JSON.stringify(languageCodes))
  }, [languageCodes])

  // Check for existing credentials and initialize
  useEffect(() => {
    const storedCredentials = localStorage.getItem('credentials')
    if (storedCredentials) {
      const credentials: Credentials = JSON.parse(storedCredentials)
      initializeApp(credentials)
    }
  }, [])

  // Initialize app with credentials
  const initializeApp = async (credentials: Credentials) => {
    try {
      setIsLoading(true)
      setLoadingFetched(0)
      setLoadingTotal(null)

      // Configure APIs
      configureAPIs(credentials)

      // Initialize IndexedDB
      await initDB(credentials.DATABASE_NAME)
      setDbName(credentials.DATABASE_NAME)

      // Check if we have articles in DB first
      const existingArticles = await getAllArticles() as IntercomArticle[]
      if (existingArticles && existingArticles.length > 0) {
        setArticles(existingArticles)
        setIsInitialized(true)
        return
      }

      // If no articles in DB, fetch from API
      const articles = await fetchIntercomArticles((fetched: number, total: number | null) => {
        setLoadingFetched(fetched)
        setLoadingTotal(total)
      }) as IntercomArticle[]
      if (articles && articles.length > 0) {
        await Promise.all(articles.map(article => saveArticle(article)))
        setArticles(articles)
        setIsInitialized(true)
      } else {
        setError('No articles found in your Intercom knowledge base.')
      }
    } catch (err) {
      console.error('Failed to initialize app:', err)
      setError('Failed to initialize the application. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle successful API credentials validation
  const handleCredentialsSuccess = () => {
    const storedCredentials = localStorage.getItem('credentials')
    if (storedCredentials) {
      initializeApp(JSON.parse(storedCredentials))
    }
  }

  // Refresh a single article from API
  const refreshArticle = async (articleId: string) => {
    try {
      const article = await fetchIntercomArticles((fetched: number, total: number | null) => {
        setLoadingFetched(fetched)
        setLoadingTotal(total)
      }, articleId) as IntercomArticle[]
      if (article && article.length > 0) {
        await saveArticle(article[0])
        const updatedArticles = await getAllArticles() as IntercomArticle[]
        setArticles(updatedArticles)
        // Update the selected article if it's the one being refreshed
        if (selectedArticle && selectedArticle.id === articleId) {
          setSelectedArticle(article[0])
        }
      }
    } catch (err) {
      console.error(`Failed to refresh article ${articleId}:`, err)
      setError(`Failed to refresh article`)
    }
  }

  // Refresh selected articles from API
  const refreshSelectedArticles = async () => {
    try {
      setIsLoading(true)
      setLoadingFetched(0)
      setLoadingTotal(articles.length)
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i]
        await refreshArticle(article.id)
        setLoadingFetched(i + 1)
      }
    } catch (err) {
      console.error('Failed to refresh selected articles:', err)
      setError('Failed to refresh selected articles')
    } finally {
      setIsLoading(false)
    }
  }

  // Subscribe to TranslationManager events only when initialized
  useEffect(() => {
    if (!isInitialized) return;

    const unsubBatchCreated = translationManager.subscribe('batchCreated', (...args: unknown[]) => {
      const [, batch] = args as [string, TranslationBatch];
      setCurrentBatch(batch);
    });
    const unsubBatchUpdated = translationManager.subscribe('batchUpdated', (...args: unknown[]) => {
      const [, batch] = args as [string, TranslationBatch];
      if (batch && currentBatch && batch.id === currentBatch.id) setCurrentBatch(batch);
    });
    const unsubTranslationCompleted = translationManager.subscribe('translationCompleted', () => {
      if (currentBatch) {
      }
    });
    return () => {
      unsubBatchCreated();
      unsubBatchUpdated();
      unsubTranslationCompleted();
    };
  }, [currentBatch, isInitialized])

  const handleLaunchTranslation = async (additionalContext: string) => {
    if (!currentBatch) return;
    try {
      // Update the batch with the latest additionalContext
      await translationManager.updateBatch(currentBatch.id, { additionalContext });
      setCurrentBatch({ ...currentBatch, additionalContext });
      await translationManager.launchTranslation(currentBatch.id);
    } catch (error) {
      console.error('Failed to launch translation:', error);
      setError('Failed to launch translation');
    }
  };

  // Approve/reject handlers
  const handleApprove = async (articleId: string) => {
    if (!currentBatch) return;
    try {
      await translationManager.approveTranslation(currentBatch.id, articleId);
    } catch (error) {
      console.error('Failed to approve translation:', error);
      setError('Failed to approve translation');
    }
  };

  const handleReject = async (articleId: string) => {
    if (!currentBatch) return;
    try {
      await translationManager.rejectTranslation(currentBatch.id, articleId);
    } catch (error) {
      console.error('Failed to reject translation:', error);
      setError('Failed to reject translation');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Intercom Translator</h1>
            <div className="flex items-center space-x-4">
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  localStorage.setItem('selectedLanguage', e.target.value);
                  window.location.reload();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {languageCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <button
                onClick={() => navigate('/api-credentials')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                API Credentials
              </button>
              <button
                onClick={() => navigate('/language-instructions')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Language Instructions
              </button>
              <button
                onClick={() => navigate('/global-settings')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Global Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded">
            {error}
          </div>
        )}

        {!isInitialized ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">Welcome to Intercom Translator</h2>
            <p className="mb-4">Please configure your API credentials to get started.</p>
            <button
              onClick={() => navigate('/api-credentials')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Configure API Credentials
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">Articles</h2>
                <button
                  onClick={refreshSelectedArticles}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
                >
                  Refresh Articles
                </button>
              </div>
              {isLoading && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{
                        width: loadingTotal
                          ? `${(loadingFetched / loadingTotal) * 100}%`
                          : '100%',
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {loadingTotal
                      ? `Loading ${loadingFetched} of ${loadingTotal} articles...`
                      : 'Loading articles...'}
                  </p>
                </div>
              )}
              <ArticleList
                articles={articles}
                selectedLanguage={selectedLanguage}
                onArticleClick={(article) => {
                  setSelectedArticle(article);
                  navigate(`/article/${article.id}`);
                }}
                onTranslateSelected={async (selectedArticles) => {
                  if (!isInitialized || !dbName) {
                    setError('Application not properly initialized');
                    return;
                  }
                  try {
                    const batch = await translationManager.createTranslationBatch(
                      selectedArticles,
                      selectedLanguage,
                      '',
                      ''
                    );
                    setCurrentBatch(batch);
                  } catch (error) {
                    console.error('Failed to create translation batch:', error);
                    setError('Failed to create translation batch');
                  }
                }}
                onRefreshSelected={refreshSelectedArticles}
              />
            </div>
          </div>
        )}
      </main>

      <Routes>
        <Route
          path="/api-credentials"
          element={
            <APICredentialsModal
              isOpen={true}
              onSuccess={handleCredentialsSuccess}
            />
          }
        />
        <Route
          path="/language-instructions"
          element={
            <LanguageInstructionsModal
              isOpen={true}
              languageCode={selectedLanguage}
              onClose={() => navigate('/')}
            />
          }
        />
        <Route
          path="/global-settings"
          element={
            <GlobalSettingsModal
              isOpen={true}
              languageCodes={languageCodes}
              onLanguageCodesChange={setLanguageCodes}
              onClose={() => navigate('/')}
            />
          }
        />
        <Route
          path="/article/:articleId"
          element={
            selectedArticle && (
              <ArticleViewerModal
                isOpen={true}
                article={selectedArticle}
                onClose={() => {
                  setSelectedArticle(null);
                  navigate('/');
                }}
                onTranslate={(article) => {
                  if (!isInitialized || !dbName) {
                    setError('Application not properly initialized');
                    return;
                  }
                  try {
                    translationManager.createTranslationBatch(
                      [article],
                      selectedLanguage,
                      '',
                      ''
                    ).then(batch => {
                      setCurrentBatch(batch);
                    });
                  } catch (error) {
                    console.error('Failed to create translation batch:', error);
                    setError('Failed to create translation batch');
                  }
                }}
                onRefresh={() => refreshArticle(selectedArticle.id)}
              />
            )
          }
        />
      </Routes>

      {currentBatch && (
        <TranslatePopup
          isOpen={true}
          batch={currentBatch}
          onClose={() => setCurrentBatch(null)}
          onLaunchTranslation={handleLaunchTranslation}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  )
}

export default App
