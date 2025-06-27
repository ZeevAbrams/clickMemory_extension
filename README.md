# ClickMemory Chrome Extension

A Chrome extension that allows you to access your ClickMemory text snippets from any webpage.

## Features

- **Secure API Key Authentication**: Uses secure API keys instead of passwords
- **Quick Access**: Access your snippets with one click from the extension icon
- **Search Functionality**: Search through your snippets quickly
- **Copy to Clipboard**: Copy snippet content with a single click
- **Shared Snippets Support**: View snippets shared with you by others
- **Settings Management**: Configure the extension to your preferences

## Installation

### Development Installation

1. Clone or download this extension folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `click-memory-extension` folder
5. The extension should now appear in your extensions list

### Production Installation

Once published to the Chrome Web Store, users can install it directly from there.

## Setup

1. **Generate API Key**: 
   - Go to your ClickMemory web app
   - Navigate to Settings → Chrome Extension Setup
   - Click "Generate API Key"
   - Copy the generated key (starts with `sk_live_`)

2. **Configure Extension**:
   - Click the ClickMemory extension icon
   - Paste your API key in the setup screen
   - Click "Connect"

3. **Start Using**:
   - Click the extension icon to view your snippets
   - Use the search bar to find specific snippets
   - Click "Copy" to copy snippet content to clipboard

## Configuration

### Settings

Access settings by clicking the gear icon (⚙️) in the extension popup:

- **API Key**: View or change your API key
- **Web App URL**: Configure the URL of your ClickMemory web app
- **Show Shared Snippets**: Toggle visibility of snippets shared with you
- **Show Snippet Preview**: Toggle snippet content preview in the list

### Default Web App URL

The extension is configured to work with: `https://click-memory-app.vercel.app`

If you're using a different URL, update it in the settings.

## Security

- **API Key Based**: No passwords stored in the extension
- **Secure Storage**: API keys are stored securely in Chrome's local storage
- **Revocable**: API keys can be revoked from the web app at any time
- **Read-Only**: Extension only has read access to your snippets

## Troubleshooting

### Connection Issues

1. **Check API Key**: Ensure your API key is correct and starts with `sk_live_`
2. **Verify Web App URL**: Make sure the web app URL in settings is correct
3. **Check Network**: Ensure you have internet connectivity
4. **API Key Expiry**: API keys expire after 1 year - generate a new one if needed

### Extension Not Working

1. **Reload Extension**: Go to `chrome://extensions/` and click the reload button
2. **Check Permissions**: Ensure the extension has the required permissions
3. **Clear Storage**: Try disconnecting and reconnecting with your API key

## Development

### File Structure

```
click-memory-extension/
├── manifest.json          # Extension manifest
├── popup.html            # Popup UI
├── popup.css             # Popup styles
├── popup.js              # Popup logic
├── background.js         # Background service worker
├── content.js            # Content script
├── icons/                # Extension icons
└── README.md             # This file
```

### Building for Production

1. Create icon files in the `icons/` directory:
   - `icon16.png` (16x16)
   - `icon32.png` (32x32)
   - `icon48.png` (48x48)
   - `icon128.png` (128x128)

2. Test the extension thoroughly

3. Package for Chrome Web Store:
   - Go to `chrome://extensions/`
   - Click "Pack extension"
   - Select the extension folder
   - Upload the generated `.crx` file to the Chrome Web Store

## API Integration

The extension communicates with your ClickMemory web app using the following endpoints:

- `GET /api/snippets` - Fetch user's snippets
- Requires `Authorization: Bearer <api_key>` header

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify your web app is properly configured
3. Ensure your API key is valid and not expired

## License

This extension is part of the ClickMemory project. 