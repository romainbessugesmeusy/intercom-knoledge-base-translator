# Intercom Knowledge Base Translator (IKBT)

A powerful web application for managing and translating Intercom knowledge base articles across multiple languages. Built with React, TypeScript, and modern web technologies.

## Features

- 🔄 **Article Management**
  - Fetch and display Intercom knowledge base articles
  - View article content in a dedicated modal
  - Refresh individual or all articles from Intercom
  - Store articles locally using IndexedDB

- 🌍 **Translation Management**
  - Support for multiple languages (fr-FR, en-US, es-ES, de-DE, it-IT, pt-BR)
  - Batch translation processing
  - Translation approval and rejection workflow
  - Additional context support for translations

- ⚙️ **Configuration**
  - API credentials management
  - Global settings configuration
  - Language-specific instructions
  - Customizable language codes

## Tech Stack

- **Frontend Framework**: React with TypeScript
- **Routing**: React Router
- **State Management**: React Hooks
- **Storage**: IndexedDB
- **Styling**: Tailwind CSS with custom components
- **Build Tool**: Vite

## Project Structure

```
src/
├── components/           # React components
│   ├── APICredentialsModal.tsx
│   ├── ArticleList.tsx
│   ├── ArticleViewerModal.tsx
│   ├── GlobalSettingsModal.tsx
│   ├── LanguageInstructionsModal.tsx
│   └── TranslatePopup.tsx
├── services/            # Business logic and API services
│   ├── api.ts
│   ├── db.ts
│   ├── proxy.ts
│   ├── settings.ts
│   └── TranslationManager.ts
├── types/              # TypeScript type definitions
├── assets/            # Static assets
├── App.tsx            # Main application component
└── main.tsx          # Application entry point
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Intercom API credentials

### Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd ikbt
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

### Configuration

1. Launch the application and enter your Intercom API credentials in the credentials modal
2. Configure your desired languages in the global settings
3. Set up language-specific instructions if needed

## Configuration

### API Credentials

The application requires the following API credentials to function:

1. **OpenAI Credentials**
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `OPENAI_ORGANIZATION_ID`: Your OpenAI organization ID
   - These are used for the translation service

2. **Intercom Credentials**
   - `INTERCOM_ACCESS_TOKEN`: Your Intercom access token
   - `INTERCOM_BASE_URL`: The Intercom API server URL (defaults to 'https://api.intercom.io/')
   - These are used to access your Intercom knowledge base

3. **Local Configuration**
   - `DATABASE_NAME`: A unique name for your local IndexedDB database
   - This is used to store articles and translation metadata locally

### Global Settings

The application provides several global settings that can be configured:

1. **Translation Settings**
   - **OpenAI Model**: Select the GPT model to use for translations (default: gpt-4)
   - **Global Instructions**: Set default instructions for all translations
   - **Language Codes**: Configure supported languages in the format 'xx' or 'xx-XX' (e.g., 'fr' or 'fr-FR')

2. **Language-Specific Settings**
   - Each language can have its own set of instructions
   - Custom glossaries can be defined per language
   - Translation preferences can be set for specific languages

3. **Settings Management**
   - Import/Export functionality for settings
   - Settings are stored locally and can be backed up
   - Settings can be shared between different installations

### Configuration Process

1. **Initial Setup**
   - Launch the application
   - Enter your API credentials in the credentials modal
   - Test each credential set to ensure proper configuration
   - Save the credentials to proceed

2. **Global Settings Configuration**
   - Access the global settings modal
   - Configure your preferred OpenAI model
   - Set up your supported languages
   - Add any global translation instructions
   - Save your settings

3. **Language-Specific Configuration**
   - Access the language instructions modal
   - Select the target language
   - Add language-specific instructions
   - Configure language-specific preferences
   - Save the configuration

### Security Notes

- API credentials are stored in the browser's localStorage
- All API calls are made directly from the client
- No credentials are stored on any server
- Consider using environment variables for sensitive credentials in production

## Translation Process

### How Translations Work

The application uses a sophisticated translation process that combines multiple layers of instructions and context:

1. **Translation Batch Creation**
   - Select articles to translate
   - Choose target language
   - Add additional context if needed
   - System creates a translation batch with unique ID

2. **Instruction Layering**
   The translation process combines multiple layers of instructions:
   - **Global Instructions**: Base instructions that apply to all translations
   - **Language-Specific Instructions**: Custom rules for the target language
   - **Additional Context**: Specific context for the current batch
   - **Glossary Terms**: Language-specific terminology and preferred translations

3. **Translation Flow**
   ```
   [Article] → [Instruction Layers] → [OpenAI API] → [Review] → [Intercom Draft] → [Admin Review] → [Published]
   ```
   - Article content is processed with all instruction layers
   - OpenAI API generates translation using GPT-4 (default)
   - Translation is reviewed and can be approved/rejected
   - Approved translations are synced to Intercom as drafts
   - Intercom admin reviews and publishes the translations
   - Translations become live in the knowledge base

4. **Translation States**
   - `pending`: Initial state
   - `in_progress`: Currently being translated
   - `translated`: Translation complete
   - `syncing`: Being synced to Intercom
   - `synced`: Successfully synced to Intercom (as draft)
   - `sync_failed`: Failed to sync to Intercom

### Translation Components

1. **System Prompt**
   - Combines all instruction layers
   - Includes language-specific rules
   - Incorporates glossary terms
   - Provides context for the translation

2. **Translation Manager**
   - Handles batch creation and management
   - Manages translation states
   - Coordinates with OpenAI API
   - Handles Intercom synchronization

3. **Quality Control**
   - Manual review of translations
   - Ability to approve or reject translations
   - Option to provide feedback for improvements
   - Draft mode for rejected translations

### Best Practices

1. **Instruction Management**
   - Keep global instructions concise and clear
   - Use language-specific instructions for cultural nuances
   - Maintain an up-to-date glossary
   - Add relevant context for each batch

2. **Translation Workflow**
   - Review translations in batches
   - Use the preview feature before syncing
   - Keep rejected translations in draft mode
   - Monitor sync status for each translation
   - Note that synced translations remain in draft state in Intercom
   - Coordinate with Intercom admin for final review and publishing

3. **Performance Optimization**
   - Use appropriate batch sizes
   - Monitor API usage and limits
   - Keep glossary terms relevant and concise
   - Regular cleanup of completed batches

## Usage

1. **Viewing Articles**
   - The main view displays all articles from your Intercom knowledge base
   - Click on an article to view its full content
   - Use the refresh button to update articles from Intercom

2. **Translation Process**
   - Select articles for translation
   - Choose target languages
   - Add additional context if needed
   - Review and approve/reject translations

3. **Settings Management**
   - Access global settings through the settings modal
   - Configure language-specific instructions
   - Manage API credentials

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the repository or contact the development team.
