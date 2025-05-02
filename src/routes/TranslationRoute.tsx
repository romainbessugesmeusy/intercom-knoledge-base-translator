import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TranslatePopup from '../components/TranslatePopup';
import { initDB, getTranslationBatch } from '../services/db';
import type { TranslationBatch, IntercomArticle } from '../types';

interface TranslationRouteProps {
  handleLaunchTranslation: (batchId: string, additionalContext: string) => Promise<void>;
  handleApprove: (article: IntercomArticle, batchId: string) => Promise<void>;
  handleReject: (article: IntercomArticle, batchId: string) => Promise<void>;
  dbName: string;
  isInitialized: boolean;
}

export function TranslationRoute({
  handleLaunchTranslation,
  handleApprove,
  handleReject,
  dbName,
  isInitialized
}: TranslationRouteProps) {
  const params = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<TranslationBatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadBatch() {
      if (params.batchId && dbName && isInitialized) {
        try {
          await initDB(dbName);
          if (cancelled) return;
          const loadedBatch = await getTranslationBatch(params.batchId);
          if (!cancelled && loadedBatch) {
            setBatch(loadedBatch);
          }
        } catch (error) {
          console.error('Failed to load batch:', error);
          if (!cancelled) {
            setError('Failed to load translation batch');
          }
        }
      }
    }
    loadBatch();
    return () => { cancelled = true; };
  }, [params.batchId, dbName, isInitialized]);

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
        <div className="bg-white p-4 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!batch) return null;

  return (
    <TranslatePopup
      isOpen={true}
      batch={batch}
      onClose={() => {
        navigate('/');
      }}
      onLaunchTranslation={(additionalContext) => handleLaunchTranslation(batch.id, additionalContext)}
      onApprove={(article) => handleApprove(article, batch.id)}
      onReject={(article) => handleReject(article, batch.id)}
    />
  );
} 