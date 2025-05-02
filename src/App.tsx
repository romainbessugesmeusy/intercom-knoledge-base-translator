import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import APICredentialsModal from './components/APICredentialsModal'
import LanguageInstructionsModal from './components/LanguageInstructionsModal'
import GlobalSettingsModal from './components/GlobalSettingsModal'
import ArticleList from './components/ArticleList'
import { fetchIntercomArticles, configureAPIs } from './services/api'
import { initDB, saveArticle, getAllArticles } from './services/db'
import type { IntercomArticle, Credentials } from './types'
import { translationManager } from './services/TranslationManager'
import { ArticleRoute } from './routes/ArticleRoute'
import { TranslationRoute } from './routes/TranslationRoute'

function App() {
  const navigate = useNavigate()
  
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
  const [error, setError] = useState<string | null>(null)
  const [dbName, setDbName] = useState<string>(() => {
    const storedCredentials = localStorage.getItem('credentials')
    return storedCredentials ? JSON.parse(storedCredentials).DATABASE_NAME : ''
  })

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

  // Check for existing credentials and initialize
  useEffect(() => {
    const storedCredentials = localStorage.getItem('credentials')
    if (storedCredentials) {
      const credentials: Credentials = JSON.parse(storedCredentials)
      initializeApp(credentials)
    }
  }, [])

  // Save language codes to localStorage when they change
  useEffect(() => {
    localStorage.setItem('languageCodes', JSON.stringify(languageCodes))
  }, [languageCodes])

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

  const handleLaunchTranslation = async (additionalContext: string) => {
    try {
      const batchId = await translationManager.launchTranslation(additionalContext);
      navigate(`/translation/${batchId}`);
    } catch (error) {
      console.error('Failed to launch translation:', error);
      setError('Failed to launch translation');
    }
  };

  // Approve/reject handlers
  const handleApprove = async (articleId: string, batchId: string) => {
    try {
      await translationManager.approveTranslation(batchId, articleId);
    } catch (error) {
      console.error('Failed to approve translation:', error);
      setError('Failed to approve translation');
    }
  };

  const handleReject = async (articleId: string, batchId: string) => {
    try {
      await translationManager.rejectTranslation(batchId, articleId);
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
          <>
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
                      navigate(`/translation/${batch.id}`);
                    } catch (error) {
                      console.error('Failed to create translation batch:', error);
                      setError('Failed to create translation batch');
                    }
                  }}
                  onRefreshSelected={refreshSelectedArticles}
                />
              </div>
            </div>

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
                  <ArticleRoute
                    isInitialized={isInitialized}
                    dbName={dbName}
                    selectedLanguage={selectedLanguage}
                    setError={setError}
                    refreshArticle={refreshArticle}
                  />
                }
              />
              <Route
                path="/translation/:batchId"
                element={
                  <TranslationRoute
                    handleLaunchTranslation={handleLaunchTranslation}
                    handleApprove={handleApprove}
                    handleReject={handleReject}
                    dbName={dbName}
                    isInitialized={isInitialized}
                  />
                }
              />
            </Routes>
          </>
        )}
      </main>
    </div>
  )
}

export default App
