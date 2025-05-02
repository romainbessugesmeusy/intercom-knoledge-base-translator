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
}

export default function TranslatePopup({
  isOpen,
  onClose,
  batch,
  onLaunchTranslation,
  onApprove,
  onReject
}: Props) {
  // Local state for batch and streamed content
  const [localBatch, setLocalBatch] = React.useState<TranslationBatch | null>(null);
  const [localStreamedContent, setLocalStreamedContent] = React.useState<Record<string, string>>({});
  const [selectedArticleId, setSelectedArticleId] = React.useState<string | null>(null);
  const [decision, setDecision] = React.useState<'approve' | 'reject' | null>(null);
  const [feedback, setFeedback] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = React.useState(batch ? batch.additionalContext || '' : '');
  const [editedContent, setEditedContent] = React.useState<Record<string, string>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<HTMLDivElement | null>(null);

  const selectedArticle = localBatch?.articles.find(t => t.article.id === selectedArticleId);

  // Create the editor div once
  React.useEffect(() => {
    if (!containerRef.current || editorRef.current) return;

    const editor = document.createElement('div');
    editor.className = 'prose max-w-none focus:outline-none focus:ring-2 focus:ring-blue-500';
    editor.contentEditable = 'true';
    
    containerRef.current.appendChild(editor);
    editorRef.current = editor;

    // Set initial content
    if (selectedArticleId && selectedArticle) {
      const content = selectedArticle.status === 'in_progress'
        ? localStreamedContent[selectedArticleId] || selectedArticle.translation || ''
        : editedContent[selectedArticleId] || selectedArticle.translation || '';
      editor.innerHTML = content;
    }

    return () => {
      editor.remove();
      editorRef.current = null;
    };
  }, [selectedArticleId, selectedArticle, localStreamedContent, editedContent]);

  // Update content when article changes
  React.useEffect(() => {
    if (!editorRef.current || !selectedArticleId) return;

    const content = selectedArticle?.status === 'in_progress'
      ? localStreamedContent[selectedArticleId] || selectedArticle?.translation || ''
      : editedContent[selectedArticleId] || selectedArticle?.translation || '';

    editorRef.current.innerHTML = content;
  }, [selectedArticleId, selectedArticle?.status, localStreamedContent, editedContent, selectedArticle?.translation]);

  React.useEffect(() => {
    if (batch) {
      setLocalBatch(batch);
      setLocalStreamedContent({});
    }
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

  const handleTranslate = () => {
    onLaunchTranslation(additionalContext);
  };

  const handleSubmit = async () => {
    if (!selectedArticle || !onApprove || !onReject || !editorRef.current) return;
    setLoading(true);
    setResult(null);
    try {
      // Get the current content from the editor
      const content = editorRef.current.innerHTML;
      setEditedContent(prev => ({
        ...prev,
        [selectedArticle.article.id]: content
      }));

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

  if (!localBatch) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[70]">
      <div className="fixed inset-0 bg-black bg-opacity-25" />
      <div className="fixed inset-0 w-screen h-screen flex items-center justify-center">
        <Dialog.Panel className="w-screen h-screen max-w-none max-h-none transform overflow-hidden rounded-none bg-white p-6 text-left align-middle shadow-xl transition-all flex flex-col">
          <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
            {localBatch.articles.every(t => t.status === 'pending') ? 'Translate Articles' : 'Review Translations'}
          </Dialog.Title>

          {localBatch.articles.every(t => t.status === 'pending') && (
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

          <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 flex-1 min-h-0">
            {/* Column 1: Article List */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 bg-gray-50 border-b">
                <h4 className="font-medium">Articles</h4>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
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
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 bg-gray-50 border-b">
                <h4 className="font-medium">Translated Content</h4>
              </div>
              <div className="flex-1 min-h-0 p-4">
                {selectedArticle ? (
                  <>
                    {selectedArticle.translatedTitle && (
                      <h2 className="text-xl font-bold mb-2">{selectedArticle.translatedTitle}</h2>
                    )}
                    {selectedArticle.status === 'in_progress' ? (
                      <div 
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{ __html: localStreamedContent[selectedArticle.article.id] || selectedArticle.translation || '' }}
                      />
                    ) : (
                      <div ref={containerRef} className="w-full h-full overflow-y-auto" style={{maxHeight: '60vh'}} />
                    )}
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
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 bg-gray-50 border-b">
                <h4 className="font-medium">Original Content</h4>
              </div>
              <div className="flex-1 min-h-0 p-4 overflow-y-auto" style={{maxHeight: '60vh'}}>
                {selectedArticle ? (
                  <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: selectedArticle.article.body || '' }} />
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
    </Dialog>
  );
} 