// Minimal browser-compatible event emitter
type Listener = (...args: unknown[]) => void;
class SimpleEventEmitter {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, listener: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  emit(event: string, ...args: unknown[]) {
    if (!this.listeners[event]) return;
    for (const listener of this.listeners[event]) {
      listener(...args);
    }
  }
}

import type { TranslationBatch, IntercomArticle } from '../types';
import {
  getTranslationBatch,
  saveTranslationBatch,
  updateTranslationBatch,
  getLatestTranslationBatch,
} from './db';
import { updateIntercomTranslation, streamOpenAICompletion } from './api';

// Event types
export type TranslationManagerEvents =
  | 'batchCreated'
  | 'batchUpdated'
  | 'batchDeleted'
  | 'translationStream'      // streaming event
  | 'translationProgress'    // article finished
  | 'translationCompleted'   // batch finished
  | 'error';

export class TranslationManager extends SimpleEventEmitter {
  constructor() {
    super();
  }

  // CRUD
  async createBatch(batch: TranslationBatch) {
    await saveTranslationBatch(batch);
    this.emit('batchCreated', batch.id, batch);
  }

  async createTranslationBatch(
    articles: IntercomArticle[],
    language: string,
    systemPrompt: string,
    additionalContext: string
  ): Promise<TranslationBatch> {
    const batch: TranslationBatch = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      language,
      status: 'in_progress',
      systemPrompt,
      additionalContext,
      articles: articles.map(article => ({
        article,
        translation: '',
        status: 'pending',
      })),
    };
    await this.createBatch(batch);
    return batch;
  }

  async approveTranslation(batchId: string, articleId: string) {
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error('Batch not found');

    // Set to syncing
    let updatedArticles = batch.articles.map(t =>
      t.article.id === articleId
        ? { ...t, status: 'syncing' as const }
        : t
    );
    await this.updateBatch(batchId, { articles: updatedArticles });

    // Call Intercom API
    const t = updatedArticles.find(t => t.article.id === articleId);
    if (!t) throw new Error('Article not found in batch');

    try {
      await updateIntercomTranslation(articleId, batch.language, {
        title: t.translatedTitle || t.article.title,
        description: t.article.description,
        body: t.translation,
        state: 'published',
      });
      updatedArticles = updatedArticles.map(t =>
        t.article.id === articleId
          ? { ...t, status: 'synced' as const, finalTranslation: t.translation, error: undefined }
          : t
      );
    } catch (err) {
      updatedArticles = updatedArticles.map(t =>
        t.article.id === articleId
          ? { ...t, status: 'sync_failed' as const, error: String(err) }
          : t
      );
    }
    await this.updateBatch(batchId, { articles: updatedArticles });
  }

  async rejectTranslation(batchId: string, articleId: string) {
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error('Batch not found');

    // Set to syncing
    let updatedArticles = batch.articles.map(t =>
      t.article.id === articleId
        ? { ...t, status: 'syncing' as const }
        : t
    );
    await this.updateBatch(batchId, { articles: updatedArticles });

    // Call Intercom API
    const t = updatedArticles.find(t => t.article.id === articleId);
    if (!t) throw new Error('Article not found in batch');

    try {
      await updateIntercomTranslation(articleId, batch.language, {
        title: t.article.title,
        description: t.article.description,
        body: t.translation,
        state: 'draft',
      });
      updatedArticles = updatedArticles.map(t =>
        t.article.id === articleId
          ? { ...t, status: 'synced' as const, error: undefined }
          : t
      );
    } catch (err) {
      updatedArticles = updatedArticles.map(t =>
        t.article.id === articleId
          ? { ...t, status: 'sync_failed' as const, error: String(err) }
          : t
      );
    }
    await this.updateBatch(batchId, { articles: updatedArticles });
  }

  async getBatch(batchId: string) {
    return getTranslationBatch(batchId);
  }

  async updateBatch(batchId: string, updates: Partial<TranslationBatch>) {
    await updateTranslationBatch(batchId, updates);
    const updated = await getTranslationBatch(batchId);
    this.emit('batchUpdated', batchId, updated);
    return updated;
  }

  async getLatestBatch() {
    return getLatestTranslationBatch();
  }

  // Launch and monitor completions (with streaming)
  async launchTranslation(batchId: string) {
    const batch = await getTranslationBatch(batchId);
    if (!batch) {
      this.emit('error', batchId, 'Batch not found');
      return;
    }

    // Update batch status to in_progress
    await this.updateBatch(batchId, { status: 'in_progress' });

    for (let i = 0; i < batch.articles.length; i++) {
      const t = batch.articles[i];
      try {
        // Update article status to in_progress
        const updatedArticles = batch.articles.map(article => 
          article.article.id === t.article.id 
            ? { ...article, status: 'in_progress' as const }
            : article
        );
        await this.updateBatch(batchId, { articles: updatedArticles });

        // Prepare messages for OpenAI
        const userPrompt = `Translate the following article title and body into ${batch.language}. Respond ONLY with valid HTML. The title should be in an <h1> tag, and the body should be formatted as HTML.\n\nTitle: ${t.article.title}\nBody: ${t.article.body}`;
        const messages = [
          { role: 'system', content: batch.systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        let streamedContent = '';
        await streamOpenAICompletion(
          messages,
          (chunk) => {
            streamedContent += chunk;
            this.emit('translationStream', batchId, t.article.id, streamedContent);
          },
          'gpt-4'
        );

        // Store the streamed HTML as the translation
        const translatedBody = streamedContent;

        // Update article status to translated, store the HTML body
        const finalArticles = updatedArticles.map(article =>
          article.article.id === t.article.id
            ? { ...article, translation: translatedBody, status: 'translated' as const, completedAt: Date.now() }
            : article
        );
        await this.updateBatch(batchId, { articles: finalArticles });
        this.emit('translationProgress', batchId, t.article.id, translatedBody);

      } catch (err) {
        // Update article status to failed
        const failedArticles = batch.articles.map(article =>
          article.article.id === t.article.id
            ? { ...article, status: 'failed' as const, error: String(err) }
            : article
        );
        await this.updateBatch(batchId, { articles: failedArticles });
        this.emit('error', batchId, err);
      }
    }

    // Update batch status to completed
    await this.updateBatch(batchId, { status: 'completed' });
    this.emit('translationCompleted', batchId);
  }

  // Utility: subscribe/unsubscribe helpers for React
  subscribe(event: TranslationManagerEvents, listener: (...args: unknown[]) => void) {
    this.on(event, listener);
    return () => this.off(event, listener);
  }
}

export const translationManager = new TranslationManager(); 