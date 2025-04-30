import { Dialog } from '@headlessui/react';
import type { TranslationBatch } from '../types';
import React from 'react';
import { translationManager } from '../services/TranslationManager';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  batch: TranslationBatch;
  onLaunchTranslation: (additionalContext: string) => void;
  onApprove?: (articleId: string) => void;
  onReject?: (articleId: string) => void;
  mode?: 'setup' | 'review';
}

export default function TranslatePopup({
  isOpen,
  onClose,
  batch,
  onLaunchTranslation,
  onApprove,
  onReject,
  mode = 'setup'
}: Props) {
  // Local state for batch and streamed content
  const [localBatch, setLocalBatch] = React.useState(batch);
  const [localStreamedContent, setLocalStreamedContent] = React.useState<Record<string, string>>({});
  const [selectedArticleId, setSelectedArticleId] = React.useState<string | null>(null);
  const [decision, setDecision] = React.useState<'approve' | 'reject' | null>(null);
  const [feedback, setFeedback] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = React.useState(batch ? batch.additionalContext || '' : '');

  React.useEffect(() => {
    setLocalBatch(batch);
    setLocalStreamedContent({});
  }, [batch]);

  React.useEffect(() => {
    if (!batch) return;
    // Subscribe to TranslationManager events for this batch
    const unsubBatchUpdated = translationManager.subscribe('batchUpdated', (...args: unknown[]) => {
      const [updatedBatchId, updatedBatch] = args as [string, TranslationBatch];
      if (updatedBatchId === batch.id) setLocalBatch(updatedBatch);
    });
    const unsubTranslationStream = translationManager.subscribe('translationStream', (...args: unknown[]) => {
      const [batchId, articleId, content] = args as [string, string, string];
      if (batchId === batch.id) {
        setLocalStreamedContent((prev: Record<string, string>) => ({ ...prev, [articleId]: content }));
      }
    });
    return () => {
      unsubBatchUpdated();
      unsubTranslationStream();
    };
  }, [batch]);

  const selectedArticle = localBatch.articles.find(t => t.article.id === selectedArticleId);

  const handleTranslate = () => {
    onLaunchTranslation(additionalContext);
  };

  const handleSubmit = async () => {
    if (!selectedArticle || !onApprove || !onReject) return;
    setLoading(true);
    setResult(null);
    try {
      if (decision === 'approve') {
        await onApprove(selectedArticle.article.id);
        setResult('Approved and updated in Intercom!');
      } else if (decision === 'reject') {
        await onReject(selectedArticle.article.id);
        setResult('Rejected and update sent to Intercom.');
      }
    } catch {
      setResult('Failed to update Intercom.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (mode === 'review') {
      setDecision(null);
      setFeedback('');
      setResult(null);
      setLoading(false);
    }
  }, [selectedArticleId, mode]);

  if (!localBatch) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[70]">
      <div className="fixed inset-0 bg-black bg-opacity-25" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-7xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
              {mode === 'setup' ? 'Translate Articles' : 'Review Translations'}
            </Dialog.Title>

            {mode === 'review' && (
              <div className="flex justify-between items-center mb-4">
                <div className="flex space-x-4">
                  <span className="text-sm text-gray-600">Pending: {localBatch.articles.filter(t => t.status === 'pending').length}</span>
                  <span className="text-sm text-green-600">Approved: {localBatch.articles.filter(t => t.status === 'completed').length}</span>
                  <span className="text-sm text-red-600">Rejected: {localBatch.articles.filter(t => t.status === 'failed').length}</span>
                </div>
              </div>
            )}

            {mode === 'setup' && (
              <div className="mb-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Destination Language</label>
                  <div className="mt-1">{localBatch.language}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Additional Context</label>
                  <textarea
                    className="w-full border rounded p-2 mt-1 text-sm"
                    rows={3}
                    placeholder="Add any additional context for the translation (optional)"
                    value={additionalContext}
                    onChange={e => setAdditionalContext(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <button type="button" className="btn btn-primary" onClick={handleTranslate}>
                    Start Translation
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 h-[600px]">
              {/* Column 1: Article List */}
              <div className="border rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50 border-b">
                  <h4 className="font-medium">Articles</h4>
                </div>
                <div className="overflow-y-auto h-[calc(100%-3rem)]">
                  <ul className="divide-y divide-gray-200">
                    {localBatch.articles.map(t => (
                      <li
                        key={t.article.id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedArticleId === t.article.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedArticleId(t.article.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-medium">{t.article.title}</h5>
                            <p className="text-sm text-gray-500 mt-1">{t.article.description}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            t.status === 'completed' ? 'bg-green-100 text-green-800' :
                            t.status === 'failed' ? 'bg-red-100 text-red-800' :
                            t.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            t.status === 'translated' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {t.status === 'in_progress' ? 'In Progress' : t.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Column 2: Translated Content */}
              <div className="border rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50 border-b">
                  <h4 className="font-medium">Translated Content</h4>
                </div>
                <div className="p-4 overflow-y-auto h-[calc(100%-3rem)]">
                  {selectedArticle ? (
                    <>
                      {selectedArticle.translatedTitle && (
                        <h2 className="text-xl font-bold mb-2">{selectedArticle.translatedTitle}</h2>
                      )}
                      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: localStreamedContent[selectedArticle.article.id] || selectedArticle.translation }} />
                      {/* Sync status UI */}
                      {selectedArticle.status === 'syncing' && (
                        <div className="mt-4 flex items-center space-x-2">
                          <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                          <span className="text-blue-700 font-medium">Syncing with Intercom...</span>
                        </div>
                      )}
                      {selectedArticle.status === 'synced' && (
                        <div className="mt-4 flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Synced with Intercom</span>
                        </div>
                      )}
                      {selectedArticle.status === 'sync_failed' && (
                        <div className="mt-4 flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Sync failed</span>
                          <button
                            type="button"
                            className="ml-2 px-3 py-1 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                            onClick={() => {
                              if (decision === 'approve' && onApprove) onApprove(selectedArticle.article.id);
                              else if (decision === 'reject' && onReject) onReject(selectedArticle.article.id);
                            }}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      {/* Approve/Reject form, only if not syncing or synced */}
                      {selectedArticle.status !== 'in_progress' && selectedArticle.status !== 'syncing' && selectedArticle.status !== 'synced' && (
                        <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
                          <div className="flex items-center space-x-6">
                            <label className="inline-flex items-center">
                              <input
                                type="radio"
                                className="form-radio h-5 w-5 text-green-600"
                                name="decision"
                                value="approve"
                                checked={decision === 'approve'}
                                onChange={() => setDecision('approve')}
                                disabled={loading || selectedArticle.status === 'completed'}
                              />
                              <span className="ml-2 text-green-700 font-medium">Approve</span>
                            </label>
                            <label className="inline-flex items-center">
                              <input
                                type="radio"
                                className="form-radio h-5 w-5 text-red-600"
                                name="decision"
                                value="reject"
                                checked={decision === 'reject'}
                                onChange={() => setDecision('reject')}
                                disabled={loading || selectedArticle.status === 'failed'}
                              />
                              <span className="ml-2 text-red-700 font-medium">Reject</span>
                            </label>
                          </div>
                          {decision === 'reject' && (
                            <textarea
                              className="w-full border rounded p-2 mt-2 text-sm"
                              rows={2}
                              placeholder="Optional feedback (reason for rejection)"
                              value={feedback}
                              onChange={e => setFeedback(e.target.value)}
                              disabled={loading}
                            />
                          )}
                          <button
                            type="submit"
                            className={`px-4 py-2 rounded-md font-semibold text-white ${decision === 'approve' ? 'bg-green-600 hover:bg-green-700' : decision === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'}`}
                            disabled={!decision || loading}
                          >
                            {loading ? 'Submitting...' : 'Submit'}
                          </button>
                          {result && (
                            <div className={`mt-2 text-sm font-medium ${result.startsWith('Failed') ? 'text-red-600' : 'text-green-600'}`}>{result}</div>
                          )}
                        </form>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500 text-center mt-8">Select an article to view its translation</p>
                  )}
                </div>
              </div>

              {/* Column 3: Original Content */}
              <div className="border rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50 border-b">
                  <h4 className="font-medium">Original Content</h4>
                </div>
                <div className="p-4 overflow-y-auto h-[calc(100%-3rem)]">
                  {selectedArticle ? (
                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: selectedArticle.article.body }} />
                  ) : (
                    <p className="text-gray-500 text-center mt-8">Select an article to view its original content</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
} 