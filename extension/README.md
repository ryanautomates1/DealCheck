# DealCheck Chrome Extension

Chrome extension for importing Zillow listings into DealCheck.

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

## Structure

- `src/content/` - Content script that extracts data from Zillow pages
- `src/popup/` - Extension popup UI
- `src/background/` - Background service worker
- `manifest.json` - Extension manifest (Manifest V3)

## Icons

Place extension icons in `icons/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)
