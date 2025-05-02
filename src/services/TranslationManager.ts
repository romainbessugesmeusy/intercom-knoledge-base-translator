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

import type { TranslationBatch, IntercomArticle, TranslatedContent } from '../types';
import {
  getTranslationBatch,
  saveTranslationBatch,
  updateTranslationBatch,
  getLatestTranslationBatch,
  getGlobalConfig,
  getLanguageInstructions,
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
    // Get global config for instructions
    const globalConfig = await getGlobalConfig();
    const globalInstructions = globalConfig?.instructions || '';

    // Get language-specific instructions
    const languageInstructions = await getLanguageInstructions(language);
    const writingInstructions = languageInstructions?.writingInstructions || '';
    const glossary = languageInstructions?.glossary || {};

    // Combine all instructions into the system prompt
    const fullSystemPrompt = [
      globalInstructions,
      writingInstructions,
      Object.entries(glossary).length > 0 ? 'Glossary:' : '',
      ...Object.entries(glossary).map(([term, translation]) => `- ${term}: ${translation}`),
      systemPrompt,
      additionalContext
    ].filter(Boolean).join('\n\n');

    const batch: TranslationBatch = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      language,
      status: 'in_progress',
      systemPrompt: fullSystemPrompt,
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

  async approveTranslation(batchId: string, article: IntercomArticle) {
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error('Batch not found');

    // Set to syncing
    let updatedArticles = batch.articles.map(t =>
      t.article.id === article.id
        ? { ...t, status: 'syncing' as const }
        : t
    );
    await this.updateBatch(batchId, { articles: updatedArticles });

    // Call Intercom API
    const t = updatedArticles.find(t => t.article.id === article.id);
    if (!t) throw new Error('Article not found in batch');

    try {
      // Ensure translated_content is updated for the batch language
      const languageCode = batch.language;
      const defaultContent: TranslatedContent = {
        title: article.title,
        description: article.description,
        body: article.body,
        state: article.state as 'draft' | 'published',
      };
      
      const translatedContent: TranslatedContent = {
        title: article.title,
        description: article.description,
        body: article.body,
        state: 'draft' as const,
      };

      const newTranslatedContent: Record<string, TranslatedContent> = {
        [article.default_locale]: defaultContent,
        [languageCode]: translatedContent
      };

      const updatedArticle = {
        ...article,
        translated_content: newTranslatedContent
      };
      await updateIntercomTranslation(updatedArticle);
      updatedArticles = updatedArticles.map(t =>
        t.article.id === article.id
          ? { ...t, status: 'synced' as const, finalTranslation: article.body, error: undefined }
          : t
      );
    } catch (err) {
      updatedArticles = updatedArticles.map(t =>
        t.article.id === article.id
          ? { ...t, status: 'sync_failed' as const, error: String(err) }
          : t
      );
    }
    await this.updateBatch(batchId, { articles: updatedArticles });
  }

  async rejectTranslation(batchId: string, article: IntercomArticle) {
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error('Batch not found');

    // Set to syncing
    let updatedArticles = batch.articles.map(t =>
      t.article.id === article.id
        ? { ...t, status: 'syncing' as const }
        : t
    );
    await this.updateBatch(batchId, { articles: updatedArticles });

    // Call Intercom API
    const t = updatedArticles.find(t => t.article.id === article.id);
    if (!t) throw new Error('Article not found in batch');

    try {
      // Ensure translated_content is updated for the batch language
      const languageCode = batch.language;
      const updatedArticle = {
        ...article,
        translated_content: {
          ...article.translated_content,
          [languageCode]: {
            title: article.title,
            description: article.description,
            body: article.body,
            state: 'draft' as const,
          }
        }
      };
      await updateIntercomTranslation(updatedArticle);
      updatedArticles = updatedArticles.map(t =>
        t.article.id === article.id
          ? { ...t, status: 'synced' as const, error: undefined }
          : t
      );
    } catch (err) {
      updatedArticles = updatedArticles.map(t =>
        t.article.id === article.id
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

    // Get global config for max concurrent translations
    const globalConfig = await getGlobalConfig();
    const maxConcurrent = globalConfig?.maxConcurrentTranslations || 3;

    // Update batch status to in_progress
    await this.updateBatch(batchId, { status: 'in_progress' });

    console.log('batch', batch);


    // Process articles in parallel with a concurrency limit
    const processArticle = async (article: typeof batch.articles[0]) => {
      try {
        // Get fresh batch state before updating
        const currentBatch = await getTranslationBatch(batchId);
        if (!currentBatch) throw new Error('Batch not found');

        // Update article status to in_progress
        const updatedArticles = currentBatch.articles.map(a => 
          a.article.id === article.article.id 
            ? { ...a, status: 'in_progress' as const, startedAt: Date.now() }
            : a
        );
        await this.updateBatch(batchId, { articles: updatedArticles });

        // Prepare messages for OpenAI
        const userPrompt = `Translate the following article title and body into ${batch.language}. Respond ONLY with valid HTML. The title should be in an <h1> tag, and the body should be formatted as HTML. Don't include backticks in the response.\n\nTitle: ${article.article.title}\nBody: ${article.article.body}`;
        const messages = [
          { role: 'system', content: batch.systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        let streamedContent = '';
        await streamOpenAICompletion(
          messages,
          (chunk) => {
            streamedContent += chunk;
            // Emit the stream event with the full content so far for this article
            this.emit('translationStream', batchId, article.article.id, streamedContent);
          },
          globalConfig?.openaiModel || 'gpt-4'
        );

        // Store the streamed HTML as the translation
        const translatedBody = streamedContent;

        // Get fresh batch state again before final update
        const finalBatch = await getTranslationBatch(batchId);
        if (!finalBatch) throw new Error('Batch not found');

        // Update article status to translated, store the HTML body
        const finalArticles = finalBatch.articles.map(a =>
          a.article.id === article.article.id
            ? { ...a, translation: translatedBody, status: 'translated' as const, completedAt: Date.now() }
            : a
        );
        await this.updateBatch(batchId, { articles: finalArticles });
        this.emit('translationProgress', batchId, article.article.id, translatedBody);

      } catch (err) {
        // Get fresh batch state before error update
        const errorBatch = await getTranslationBatch(batchId);
        if (!errorBatch) throw new Error('Batch not found');

        // Update article status to failed
        const failedArticles = errorBatch.articles.map(a =>
          a.article.id === article.article.id
            ? { ...a, status: 'failed' as const, error: String(err) }
            : a
        );
        await this.updateBatch(batchId, { articles: failedArticles });
        this.emit('error', batchId, err);
      }
    };

    // Process articles in parallel with concurrency limit
    const chunks = [];
    for (let i = 0; i < batch.articles.length; i += maxConcurrent) {
      chunks.push(batch.articles.slice(i, i + maxConcurrent));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(processArticle));
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