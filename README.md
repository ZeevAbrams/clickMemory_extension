# ClickMemory Chrome Extension

A Chrome extension that allows you to access your ClickMemory text snippets from any webpage with a simple right-click.

## Features

- **Secure API Key Authentication**: Uses secure API keys instead of passwords
- **Right-Click Access**: Access your snippets directly from any webpage's context menu
- **Quick Copy**: Copy snippet content with a single click
- **Search Functionality**: Search through your snippets quickly
- **Shared Snippets Support**: View snippets shared with you by others
- **Settings Management**: Configure the extension to your preferences

## How to Use ClickMemory Extension

Follow these steps to set up and use the ClickMemory browser extension for quick access to your snippets.

### Step 1: Create a New Snippet

Start by creating a snippet that you want to access quickly from any webpage.

1. Go to your ClickMemory web app at [https://click-memory.vercel.app](https://click-memory.vercel.app)
2. Navigate to the dashboard
3. Click "Create New Snippet"
4. Add your text content and save

### Step 2: Select Your Snippet

Choose which snippet you want to use with the extension. You can create multiple snippets and switch between them.

1. View your snippets in the dashboard
2. Note which snippet you want to access via the extension
3. You can edit or create additional snippets as needed

### Step 3: Get Your API Key

Generate an API key from the Settings page. This key will securely connect your extension to your ClickMemory account.

1. Go to Settings in your ClickMemory web app
2. Navigate to Chrome Extension Setup
3. Click "Generate API Key"
4. Copy the generated key (starts with `sk_live_`)

### Step 4: Install the Extension

Install the ClickMemory browser extension from the Chrome Web Store to access your snippets from any webpage.

1. Visit the Chrome Web Store
2. Search for "ClickMemory"
3. Click "Add to Chrome"
4. Confirm the installation

### Step 5: Configure the Extension

Open the extension, paste your API key, and you're ready to right-click and access your snippets anywhere!

1. Click the ClickMemory extension icon
2. Paste your API key in the setup screen
3. Click "Connect"
4. **Pro tip:** Once configured, you can right-click on any webpage and select your snippet from the context menu for instant access

## Configuration

### Settings

Access settings by clicking the gear icon (⚙️) in the extension popup:

- **API Key**: View or change your API key
- **Web App URL**: Configure the URL of your ClickMemory web app
- **Show Shared Snippets**: Toggle visibility of snippets shared with you
- **Show Snippet Preview**: Toggle snippet content preview in the list

### Default Web App URL

The extension is configured to work with: `https://click-memory.vercel.app`

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

## API Integration

The extension communicates with your ClickMemory web app using the following endpoints:

- `GET /api/snippets` - Fetch user's snippets
- Requires `Authorization: Bearer <api_key>` header

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify your web app is properly configured
3. Ensure your API key is valid and not expired
4. Email us at info@iteraite.com

## Privacy & Terms

- [Privacy Policy](privacy-policy.html)
- [Terms and Conditions](terms-and-conditions.html)

## License

This extension is part of the ClickMemory project. 