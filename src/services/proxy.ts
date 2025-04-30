import axios, { AxiosResponse } from 'axios';
import type { IntercomArticle, TranslatedContent } from '../types';

let intercomConfig = {
  accessToken: '',
  baseUrl: 'https://api.intercom.io/',
};

export function configureProxy(config: {
  INTERCOM_ACCESS_TOKEN: string;
  INTERCOM_BASE_URL: string;
}) {
  intercomConfig = {
    accessToken: config.INTERCOM_ACCESS_TOKEN,
    baseUrl: config.INTERCOM_BASE_URL,
  };
}

export async function fetchIntercomArticles(
  onProgress?: (fetched: number, total: number | null) => void,
  articleId?: string
): Promise<IntercomArticle[]> {
  if (articleId) {
    const response: AxiosResponse = await axios.get(`/api/intercom/articles/${articleId}`, {
      headers: {
        'Authorization': `Bearer ${intercomConfig.accessToken}`,
      },
    });
    return [response.data];
  }

  let allArticles: IntercomArticle[] = [];
  let nextPage: string | null = '/api/intercom/articles';
  let totalCount: number | null = null;

  while (nextPage) {
    const response: AxiosResponse = await axios.get(nextPage, {
      headers: {
        'Authorization': `Bearer ${intercomConfig.accessToken}`,
      },
    });

    const articles = response.data.data || [];
    allArticles = [...allArticles, ...articles];

    // Try to get total_count if available
    if (totalCount === null && typeof response.data.total_count === 'number') {
      totalCount = response.data.total_count;
    }

    if (onProgress) {
      onProgress(allArticles.length, totalCount);
    }

    nextPage = response.data.pages.next
      ? `/api/intercom/articles?${new URL(response.data.pages.next).searchParams.toString()}`
      : null;
  }

  return allArticles;
}

export async function updateIntercomTranslation(
  articleId: string,
  languageCode: string,
  translation: TranslatedContent
) {
  // Build the translated_content payload for the given language
  const translated_content = {
    [languageCode]: {
      ...translation,
      state: 'draft',
    }
  };
  return axios.put(`/api/intercom/articles/${articleId}`, {
    translated_content
  }, {
    headers: {
      'Authorization': `Bearer ${intercomConfig.accessToken}`,
    },
  });
}

export async function validateIntercomCredentials(): Promise<boolean> {
  try {
    await axios.get('/api/intercom/articles?per_page=1', {
      headers: {
        'Authorization': `Bearer ${intercomConfig.accessToken}`,
      },
    });
    return true;
  } catch {
    return false;
  }
} 