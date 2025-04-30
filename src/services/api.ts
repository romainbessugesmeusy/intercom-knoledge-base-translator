import axios from 'axios';
import { configureProxy, fetchIntercomArticles as fetchArticles, updateIntercomTranslation as updateTranslation, validateIntercomCredentials as validateIntercom } from './proxy';
import { getGlobalConfig } from './db';

// API Configuration
let openaiConfig = {
  apiKey: '',
  organizationId: '',
};

export function configureAPIs(config: {
  INTERCOM_ACCESS_TOKEN: string;
  INTERCOM_BASE_URL: string;
  OPENAI_API_KEY: string;
  OPENAI_ORGANIZATION_ID: string;
}) {
  configureProxy({
    INTERCOM_ACCESS_TOKEN: config.INTERCOM_ACCESS_TOKEN,
    INTERCOM_BASE_URL: config.INTERCOM_BASE_URL,
  });
  
  openaiConfig = {
    apiKey: config.OPENAI_API_KEY,
    organizationId: config.OPENAI_ORGANIZATION_ID,
  };
}

// OpenAI API
export const openaiApi = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

openaiApi.interceptors.request.use((config) => {
  config.headers['Authorization'] = `Bearer ${openaiConfig.apiKey}`;
  if (openaiConfig.organizationId) {
    config.headers['OpenAI-Organization'] = openaiConfig.organizationId;
  }
  return config;
});

export async function translateWithOpenAI(
  title: string,
  body: string,
  systemPrompt: string,
  targetLanguage: string
): Promise<{ translatedTitle: string, translatedBody: string }> {
  const globalConfig = await getGlobalConfig();
  const model = globalConfig?.openaiModel || 'gpt-4';

  const userPrompt = `Translate the following article title and body into ${targetLanguage}. Return a JSON object with keys 'translatedTitle' and 'translatedBody'.\n\nTitle: ${title}\nBody: ${body}`;

  const response = await openaiApi.post<{ choices: Array<{ message: { content: string } }> }>('/chat/completions', {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  });

  // Parse the JSON from the model's response
  const content = response.data.choices[0].message.content;
  try {
    return JSON.parse(content || '{}');
  } catch {
    // fallback: return as body if parsing fails
    return { translatedTitle: '', translatedBody: content };
  }
}

export async function streamOpenAICompletion(
  messages: Array<{ role: string; content: string }>,
  onStream: (chunk: string) => void,
  model: string = 'gpt-4'
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiConfig.apiKey}`,
      ...(openaiConfig.organizationId && { 'OpenAI-Organization': openaiConfig.organizationId }),
    },
    body: JSON.stringify({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      })),
      temperature: 0.3,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to get response reader');
  }

  let fullResponse = '';
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim() !== '');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onStream(content);
          }
        } catch (e) {
          console.error('Error parsing streaming response:', e);
        }
      }
    }
  }

  return fullResponse;
}

// Re-export Intercom functions from proxy
export { fetchArticles as fetchIntercomArticles };
export { updateTranslation as updateIntercomTranslation };
export { validateIntercom as validateIntercomCredentials };

export async function validateOpenAICredentials(): Promise<boolean> {
  try {
    await openaiApi.get('/models');
    return true;
  } catch {
    return false;
  }
} 