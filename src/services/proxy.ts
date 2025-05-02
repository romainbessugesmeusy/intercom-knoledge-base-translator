import axios, { AxiosResponse } from 'axios';
import type { IntercomArticle } from '../types';

let intercomConfig = {
  accessToken: '',
  baseUrl: 'https://api.intercom.io/',
};

const baseURL = import.meta.env.VITE_INTERCOM_BASE_URL || '/api/intercom';

console.log('PROXY baseURL', baseURL);
// Axios instance for Intercom API
let intercomClient = axios.create({
  baseURL,
});

export function configureProxy(config: {
  INTERCOM_ACCESS_TOKEN: string;
  INTERCOM_BASE_URL: string;
}) {
  intercomConfig = {
    accessToken: config.INTERCOM_ACCESS_TOKEN,
    baseUrl: config.INTERCOM_BASE_URL,
  };
  // Update the Axios instance with new token
  intercomClient = axios.create({
    baseURL,
    headers: {
      'Authorization': `Bearer ${intercomConfig.accessToken}`,
    },
  });
}

export async function fetchIntercomArticles(
  onProgress?: (fetched: number, total: number | null) => void,
  articleId?: string
): Promise<IntercomArticle[]> {
  if (articleId) {
    const response: AxiosResponse = await intercomClient.get(`/articles/${articleId}`);
    return [response.data];
  }

  let allArticles: IntercomArticle[] = [];
  let nextPage: string | null = '/articles';
  let totalCount: number | null = null;

  while (nextPage) {
    const response: AxiosResponse = await intercomClient.get(nextPage);
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
      ? `/articles?${new URL(response.data.pages.next).searchParams.toString()}`
      : null;
  }

  return allArticles;
}

export async function updateIntercomTranslation(article: IntercomArticle) {
  return intercomClient.put(`/articles/${article.id}`, article);
}

export async function validateIntercomCredentials(): Promise<boolean> {
  try {
    await intercomClient.get('/articles?per_page=1');
    return true;
  } catch {
    return false;
  }
} 