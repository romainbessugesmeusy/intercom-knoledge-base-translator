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
      let updatedArticle = article;
      if(languageCode === article.default_locale) {
        // Override the default translated content
        updatedArticle = {
          ...article,
          title: t.translatedTitle || article.title,
          body: t.translation || article.body,
          translated_content: {
            ...article.translated_content,
            [languageCode]: {
              title: t.translatedTitle || article.title,
              description: article.description,
              body: t.translation || article.body,
              state: article.state,
            }
          }
        }
      } else {
        // Don't override the default translated content
        const defaultTranslatedContent = article.translated_content?.[article.default_locale];
        updatedArticle = {
          ...article,
          title: defaultTranslatedContent?.title || article.title,
          body: defaultTranslatedContent?.body || article.body,
          translated_content: {
            ...article.translated_content,
            [languageCode]: {
              title: t.translatedTitle || article.title,
              description: article.description,
              body: t.translation || article.body,
              state: 'draft' as const,
            }
          }
        }
      };
      await updateIntercomTranslation(updatedArticle);
      updatedArticles = updatedArticles.map(t =>
        t.article.id === article.id
          ? { ...t, status: 'synced' as const, finalTranslation: t.translation || article.body, error: undefined }
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

    // Update the article status to rejected in the batch
    const updatedArticles = batch.articles.map(t =>
      t.article.id === article.id
        ? { ...t, status: 'sync_failed' as const, error: 'Translation rejected' }
        : t
    );

    // Update the batch with the rejected status
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
    const processArticle = async (article: typeof batch.articles[0], currentBatch: TranslationBatch) => {
      try {
        // Update article status to in_progress in the current batch
        const articleIndex = currentBatch.articles.findIndex(a => a.article.id === article.article.id);
        if (articleIndex === -1) throw new Error('Article not found in batch');

        currentBatch.articles[articleIndex] = {
          ...currentBatch.articles[articleIndex],
          status: 'in_progress' as const,
          startedAt: Date.now()
        };
        await this.updateBatch(batchId, { articles: currentBatch.articles });

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
            this.emit('translationStream', batchId, String(article.article.id), streamedContent);
          },
          globalConfig?.openaiModel || 'gpt-4'
        );

        // Store the complete streamed HTML as the translation
        const translatedBody = streamedContent;

        // Update article with translation and status
        currentBatch.articles[articleIndex] = {
          ...currentBatch.articles[articleIndex],
          translation: translatedBody,
          status: 'translated' as const,
          completedAt: Date.now()
        };
        await this.updateBatch(batchId, { articles: currentBatch.articles });
        this.emit('translationProgress', batchId, article.article.id, translatedBody);

      } catch (err) {
        // Update article status to failed in the current batch
        const articleIndex = currentBatch.articles.findIndex(a => a.article.id === article.article.id);
        if (articleIndex !== -1) {
          currentBatch.articles[articleIndex] = {
            ...currentBatch.articles[articleIndex],
            status: 'failed' as const,
            error: String(err)
          };
          await this.updateBatch(batchId, { articles: currentBatch.articles });
        }
        this.emit('error', batchId, err);
      }
    };

    // Process articles in parallel with concurrency limit
    const chunks = [];
    for (let i = 0; i < batch.articles.length; i += maxConcurrent) {
      chunks.push(batch.articles.slice(i, i + maxConcurrent));
    }

    // Process each chunk sequentially, but articles within chunk in parallel
    for (const chunk of chunks) {
      // Get fresh batch state before processing chunk
      const currentBatch = await this.getBatch(batchId);
      if (!currentBatch) throw new Error('Batch not found');
      
      await Promise.all(chunk.map(article => processArticle(article, currentBatch)));
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