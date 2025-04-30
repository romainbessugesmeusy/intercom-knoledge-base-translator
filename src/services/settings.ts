import { Credentials, GlobalConfig, LanguageInstructions } from '../types';
import { initDB, getGlobalConfig, saveGlobalConfig, saveLanguageInstructions } from './db';

interface SettingsExport {
  credentials: Credentials;
  globalConfig: GlobalConfig;
  languageInstructions: LanguageInstructions[];
}

export class SettingsService {
  /**
   * Export all settings to a JSON file
   */
  static async exportSettings(): Promise<void> {
    try {
      // Get all settings from IndexedDB
      const credentials = await this.getCredentials();
      const globalConfig = await getGlobalConfig();
      const languageInstructions = await this.getAllLanguageInstructions();

      if (!globalConfig) {
        throw new Error('Global config not found');
      }

      const settings: SettingsExport = {
        credentials,
        globalConfig,
        languageInstructions,
      };

      // Create and download the file
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `intercom-translator-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting settings:', error);
      throw error;
    }
  }

  /**
   * Import settings from a JSON file
   */
  static async importSettings(file: File): Promise<void> {
    try {
      const text = await file.text();
      const settings: SettingsExport = JSON.parse(text);

      // Validate the imported data
      this.validateSettings(settings);

      // Save all settings to IndexedDB
      await this.saveCredentials(settings.credentials);
      await saveGlobalConfig(settings.globalConfig);
      
      // Save each language instruction
      for (const instruction of settings.languageInstructions) {
        await saveLanguageInstructions(instruction);
      }
    } catch (error) {
      console.error('Error importing settings:', error);
      throw error;
    }
  }

  private static validateSettings(settings: SettingsExport): void {
    if (!settings.credentials || !settings.globalConfig || !settings.languageInstructions) {
      throw new Error('Invalid settings format');
    }

    // Validate credentials
    const requiredCredentials = ['OPENAI_API_KEY', 'OPENAI_ORGANIZATION_ID', 'INTERCOM_ACCESS_TOKEN', 'INTERCOM_BASE_URL', 'DATABASE_NAME'];
    for (const key of requiredCredentials) {
      if (!settings.credentials[key as keyof Credentials]) {
        throw new Error(`Missing required credential: ${key}`);
      }
    }

    // Validate global config
    if (!settings.globalConfig.instructions || !settings.globalConfig.openaiModel) {
      throw new Error('Invalid global config format');
    }

    // Validate language instructions
    if (!Array.isArray(settings.languageInstructions)) {
      throw new Error('Language instructions must be an array');
    }

    for (const instruction of settings.languageInstructions) {
      if (!instruction.languageCode || typeof instruction.writingInstructions !== 'string') {
        throw new Error('Invalid language instruction format');
      }
    }
  }

  private static async getCredentials(): Promise<Credentials> {
    const storedCredentials = localStorage.getItem('credentials');
    if (!storedCredentials) {
      throw new Error('No credentials found');
    }
    try {
      return JSON.parse(storedCredentials) as Credentials;
    } catch {
      throw new Error('Failed to parse stored credentials');
    }
  }

  private static async getAllLanguageInstructions(): Promise<LanguageInstructions[]> {
    const db = await initDB('intercom-translator');
    return new Promise((resolve, reject) => {
      const store = db.transaction('prompts', 'readonly').objectStore('prompts');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private static async saveCredentials(credentials: Credentials): Promise<void> {
    try {
      localStorage.setItem('credentials', JSON.stringify(credentials));
    } catch {
      throw new Error('Failed to save credentials');
    }
  }
} 