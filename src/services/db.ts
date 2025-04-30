import type { IntercomArticle, LanguageInstructions, GlobalConfig, TranslationBatch } from '../types';

let db: IDBDatabase | null = null;
let initPromise: Promise<IDBDatabase> | null = null;

export async function initDB(databaseName: string) {
  console.log('Initializing database...');
  
  // If database is already initialized, return it
  if (db) {
    console.log('Database already initialized');
    return db;
  }

  // If initialization is in progress, return the existing promise
  if (initPromise) {
    console.log('Database initialization already in progress');
    return initPromise;
  }

  // Create a new initialization promise
  initPromise = new Promise<IDBDatabase>((resolve, reject) => {
    console.log('Opening database...');
    
    const request = indexedDB.open(databaseName, 2);

    request.onerror = () => {
      console.error('Error opening database');
      initPromise = null;
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      console.log('Database opened successfully');
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = () => {
      console.log('Upgrading database...');
      const db = request.result;

      try {
        if (!db.objectStoreNames.contains('credentials')) {
          db.createObjectStore('credentials');
          console.log('Created credentials store');
        }
      } catch (error) {
        console.error('Failed to create credentials store:', error);
      }

      try {
        if (!db.objectStoreNames.contains('articles')) {
          db.createObjectStore('articles', { keyPath: 'id' });
          console.log('Created articles store');
        }
      } catch (error) {
        console.error('Failed to create articles store:', error);
      }

      try {
        if (!db.objectStoreNames.contains('prompts')) {
          db.createObjectStore('prompts', { keyPath: 'languageCode' });
          console.log('Created prompts store');
        }
      } catch (error) {
        console.error('Failed to create prompts store:', error);
      }

      try {
        if (!db.objectStoreNames.contains('glossaries')) {
          db.createObjectStore('glossaries', { keyPath: 'languageCode' });
          console.log('Created glossaries store');
        }
      } catch (error) {
        console.error('Failed to create glossaries store:', error);
      }

      try {
        if (!db.objectStoreNames.contains('globalConfig')) {
          db.createObjectStore('globalConfig');
          console.log('Created globalConfig store');
        }
      } catch (error) {
        console.error('Failed to create globalConfig store:', error);
      }

      try {
        if (!db.objectStoreNames.contains('translationBatches')) {
          db.createObjectStore('translationBatches', { keyPath: 'id' });
          console.log('Created translationBatches store');
        }
      } catch (error) {
        console.error('Failed to create translationBatches store:', error);
      }
    };

    request.onblocked = (event) => {
      console.error('Database open request blocked:', event);
      initPromise = null;
      reject(new Error('Database open request blocked'));
    };
  });

  return initPromise;
}

// Helper function to create a transaction
function createTransaction(storeName: string, mode: IDBTransactionMode = 'readonly') {
  if (!db) throw new Error('Database not initialized');
  return db.transaction(storeName, mode);
}

// Helper function to get a store
function getStore(storeName: string, mode: IDBTransactionMode = 'readonly') {
  const transaction = createTransaction(storeName, mode);
  return transaction.objectStore(storeName);
}

// Articles
export async function saveArticle(article: IntercomArticle) {
  return new Promise((resolve, reject) => {
    const store = getStore('articles', 'readwrite');
    const request = store.put(article);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getArticle(id: string) {
  return new Promise((resolve, reject) => {
    const store = getStore('articles');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllArticles() {
  return new Promise((resolve, reject) => {
    const store = getStore('articles');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Language Instructions
export async function saveLanguageInstructions(instructions: LanguageInstructions) {
  return new Promise((resolve, reject) => {
    const store = getStore('prompts', 'readwrite');
    const request = store.put(instructions);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getLanguageInstructions(languageCode: string): Promise<LanguageInstructions | undefined> {
  return new Promise((resolve, reject) => {
    const store = getStore('prompts');
    const request = store.get(languageCode);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Glossaries
export async function saveGlossary(languageCode: string, glossary: Record<string, string>) {
  return new Promise((resolve, reject) => {
    const store = getStore('glossaries', 'readwrite');
    const request = store.put({ languageCode, ...glossary });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getGlossary(languageCode: string) {
  return new Promise((resolve, reject) => {
    const store = getStore('glossaries');
    const request = store.get(languageCode);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Global Config
export async function saveGlobalConfig(config: GlobalConfig) {
  return new Promise((resolve, reject) => {
    const store = getStore('globalConfig', 'readwrite');
    const request = store.put(config, 'config');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getGlobalConfig(): Promise<GlobalConfig | undefined> {
  return new Promise((resolve, reject) => {
    const store = getStore('globalConfig');
    const request = store.get('config');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Translation Batches
export async function saveTranslationBatch(batch: TranslationBatch) {
  return new Promise((resolve, reject) => {
    const store = getStore('translationBatches', 'readwrite');
    const request = store.put(batch);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getTranslationBatch(id: string): Promise<TranslationBatch | undefined> {
  return new Promise((resolve, reject) => {
    const store = getStore('translationBatches');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateTranslationBatch(id: string, updates: Partial<TranslationBatch>) {
  const batch = await getTranslationBatch(id);
  if (!batch) return null;
  
  const updatedBatch = {
    ...batch,
    ...updates,
    updatedAt: Date.now(),
  };
  
  return saveTranslationBatch(updatedBatch as TranslationBatch);
}

export async function getLatestTranslationBatch() {
  return new Promise((resolve, reject) => {
    const store = getStore('translationBatches');
    const request = store.getAll();
    request.onsuccess = () => {
      const batches = request.result as TranslationBatch[];
      resolve(batches.sort((a, b) => b.createdAt - a.createdAt)[0]);
    };
    request.onerror = () => reject(request.error);
  });
} 