# AI Page Summarizer

A Chrome browser extension that uses AI to summarize webpage content with support for both text and visual content.

## Features

- 📝 **AI-Powered Summarization**: Summarizes webpage content using Google's Gemini AI
- 🖼️ **Multimodal Support**: Processes both text and screenshots for comprehensive summaries
- 📁 **File Upload**: Upload local files for AI processing
- 💬 **Chat History**: Maintains conversation history with the AI
- 🎨 **Modern UI**: Clean and intuitive interface

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-page-summarizer.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in the top right)

4. Click "Load unpacked" and select the extension directory

## Configuration

1. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

2. Open the extension popup and enter your API key in the settings

## Usage

1. Click the extension icon while on any webpage

2. Choose from the following options:
   - **Summarize Page**: Get an AI summary of the current page
   - **Upload File**: Upload a local file for AI processing
   - **Chat**: Continue conversation with the AI about the content

## Files Structure

- `manifest.json` - Extension configuration
- `popup.html` - Extension popup interface
- `popup.js` - Popup logic and AI integration
- `content.js` - Content script for page interaction
- `background.js` - Background service worker
- `style.css` - Popup styling
- `content.css` - Content script styling
- `file-upload-styles.css` - File upload UI styling

## Technologies Used

- Chrome Extension Manifest V3
- Google Gemini API
- Vanilla JavaScript
- CSS3

## Permissions

The extension requires the following permissions:
- `activeTab` - Access to the current tab
- `scripting` - Inject content scripts
- `storage` - Store chat history and settings
- `<all_urls>` - Access webpage content

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
