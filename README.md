# Intercom Knowledge Base Translator (IKBT)

IKBT is a web application designed to manage the translation process of an entire Intercom knowledge base. It leverages OpenAI's GPT-4 to provide high-quality translations while maintaining consistency across your knowledge base.

## Features

- **Multi-language Support**: Supports translation into 30+ languages including Arabic, Chinese, French, German, Spanish, and more
- **Bulk Translation**: Translate multiple articles at once with progress tracking
- **Customizable Translation Instructions**: 
  - Global instructions that apply to all translations
  - Language-specific instructions and glossaries
  - Additional context for specific translation batches
- **Article Management**:
  - View and manage all your Intercom articles
  - Track translation status for each language
  - Preview articles before translation
- **Secure API Integration**:
  - Secure storage of API keys in browser session storage
  - Direct integration with Intercom and OpenAI APIs

## Prerequisites

- Intercom API credentials (Client ID and Client Secret)
- OpenAI API key and Organization ID
- Modern web browser with IndexedDB support

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the application
5. Enter your API credentials when prompted:
   - OpenAI API Key
   - OpenAI Organization ID
   - Intercom Client ID
   - Intercom Client Secret
   - Database Name

## Usage

### Initial Setup

1. When first loading the application, you'll be prompted to enter your API credentials
2. The application will verify access to both Intercom and OpenAI APIs
3. A local IndexedDB database will be created to store articles and translation metadata

### Managing Translations

1. **Select Destination Language**: Choose the target language from the dropdown in the header
2. **View Articles**: Browse your knowledge base articles in the main grid
3. **Translate Articles**:
   - Select individual articles using checkboxes
   - Click "Translate" on individual articles or "Translate Selected Articles" for bulk translation
   - Add additional context if needed
   - Monitor translation progress in real-time

### Customizing Translation Instructions

1. **Global Instructions**:
   - Click "Global Instructions" in the header
   - Enter instructions that apply to all translations
   - Save changes

2. **Language-Specific Instructions**:
   - Click "Translation Instructions" in the header
   - Select the target language
   - Enter writing instructions and glossary terms
   - Save changes

## Technical Details

### Data Structure

The application uses the following data structure for articles:

```typescript
interface IntercomArticle {
  id: string;
  title: string;
  description: string;
  body: string;
  state: 'published' | 'draft';
  created_at: number;
  updated_at: number;
  translated_content: {
    [languageCode: string]: {
      title: string;
      description: string;
      body: string;
      state: 'published' | 'draft';
    }
  }
}
```

### API Integration

- **Intercom API**: Used for fetching and updating articles
- **OpenAI API**: Used for translation services
- **IndexedDB**: Used for local storage of articles and translation metadata

## TODO

1. **Error Handling**:
   - Implement more robust error handling for API failures
   - Add retry mechanisms for failed translations
   - Improve error messages and user feedback

2. **Performance**:
   - Implement pagination for large article lists
   - Add caching for frequently accessed articles
   - Optimize bulk translation process

3. **User Experience**:
   - Add translation preview before saving
   - Implement translation history
   - Add ability to revert translations
   - Add search and filtering capabilities

4. **Security**:
   - Implement API key rotation
   - Add rate limiting for API calls
   - Add user authentication

5. **Testing**:
   - Add unit tests for core functionality
   - Add integration tests for API interactions
   - Add end-to-end tests for critical user flows

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
