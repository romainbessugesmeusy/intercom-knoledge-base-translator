import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ArticleViewerModal from '../components/ArticleViewerModal';
import { initDB, getAllArticles } from '../services/db';
import { translationManager } from '../services/TranslationManager';
import type { IntercomArticle } from '../types';

interface ArticleRouteProps {
  isInitialized: boolean;
  dbName: string;
  selectedLanguage: string;
  setError: (error: string | null) => void;
  refreshArticle: (id: string) => Promise<void>;
}

export function ArticleRoute({ 
  isInitialized, 
  dbName, 
  selectedLanguage, 
  setError, 
  refreshArticle
}: ArticleRouteProps) {
  const params = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<IntercomArticle | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadArticle() {
      if (params.articleId && dbName && isInitialized) {
        try {
          await initDB(dbName);
          if (cancelled) return;
          const allArticles = await getAllArticles() as IntercomArticle[];
          const foundArticle = allArticles.find(a => a.id === params.articleId);
          if (!cancelled && foundArticle) {
            setArticle(foundArticle);
          }
        } catch (error) {
          console.error('Failed to load article:', error);
          if (!cancelled) setError('Failed to load article');
        }
      }
    }
    loadArticle();
    return () => { cancelled = true; };
  }, [params.articleId, dbName, isInitialized, setError]);

  if (!article) return null;

  return (
    <ArticleViewerModal
      isOpen={true}
      article={article}
      onClose={() => {
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
            navigate(`/translation/${batch.id}`);
          });
        } catch (error) {
          console.error('Failed to create translation batch:', error);
          setError('Failed to create translation batch');
        }
      }}
      onRefresh={async () => {
        if (params.articleId) {
          await refreshArticle(params.articleId);
        }
      }}
    />
  );
} 