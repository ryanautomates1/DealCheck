# DealMetrics Chrome Extension

Chrome extension for importing Zillow listings into DealMetrics.

## Development

1. Install dependencies:
```bash
npm install
```

2. Build the extension:
```bash
npm run build
```

3. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/dist` directory

## Building

The extension uses Vite to bundle TypeScript files. The build output goes to `dist/`.

## Release checklist (Chrome Web Store upload)

Before each store upload:

1. **Build from source** (so `dist/` matches the repo):
   ```bash
   cd extension
   npm run build
   ```
2. **Zip the contents of `dist/`** (not the `dist` folder itself), so the zip has `manifest.json`, `content.js`, `background.js`, etc. at the root. For example, from the `extension` folder:
   - Windows (PowerShell): `Compress-Archive -Path dist\* -DestinationPath dealmetrics-extension.zip -Force`
   - Or zip the files inside `dist/` so the archive root contains `manifest.json`, `icons/`, etc.
3. Upload the zip in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Structure

- `src/content/` - Content script that extracts data from Zillow pages
- `src/popup/` - Extension popup UI
- `src/background/` - Background service worker
- `manifest.json` - Extension manifest (Manifest V3)

## Icons

The manifest expects `icons/icon48.png` (48x48) and `icons/icon128.png` (128x128). These are copied into `dist/icons/` during `npm run build`. Replace them in `icons/` if you want a custom icon set.
