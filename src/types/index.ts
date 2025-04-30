export interface IntercomArticle {
  type: 'article';
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  body: string;
  author_id: string;
  state: 'published' | 'draft';
  created_at: number;
  updated_at: number;
  url: string;
  parent_id: string;
  parent_type: string;
  default_locale: string;
  translated_content: Record<string, TranslatedContent>;
  tags: {
    name: string;
    id: string;
  }[];
}

export interface TranslatedContent {
  title: string;
  description: string;
  body: string;
  state: 'published' | 'draft';
}

export interface Credentials {
  OPENAI_API_KEY: string;
  OPENAI_ORGANIZATION_ID: string;
  INTERCOM_ACCESS_TOKEN: string;
  INTERCOM_BASE_URL: string;
  DATABASE_NAME: string;
}

export interface LanguageInstructions {
  languageCode: string;
  writingInstructions: string;
  glossary: Record<string, string>;
}

export interface GlobalConfig {
  instructions: string;
  openaiModel: string;
}

export interface TranslationState {
  articleId: string;
  languageCode: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error' | 'syncing' | 'synced' | 'sync_failed';
  error?: string;
}

export interface TranslationBatch {
  id: string;
  createdAt: number;
  updatedAt: number;
  language: string;
  status: 'pending' | 'in_progress' | 'translated' | 'completed' | 'failed' | 'syncing' | 'synced' | 'sync_failed';
  systemPrompt: string;
  additionalContext: string;
  articles: Array<{
    article: IntercomArticle;
    translation: string;
    translatedTitle?: string;
    finalTranslation?: string;
    status: 'pending' | 'in_progress' | 'translated' | 'completed' | 'failed' | 'syncing' | 'synced' | 'sync_failed';
    error?: string;
    startedAt?: number;
    completedAt?: number;
  }>;
} 