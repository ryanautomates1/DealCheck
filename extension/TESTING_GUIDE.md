# Extension Testing Guide

## ✅ Build Complete!

The extension has been successfully built. The `extension/dist` directory contains all files needed to load the extension in Chrome.

## Files in dist/

- `manifest.json` - Extension manifest
- `popup.html` - Extension popup UI
- `content.js` - Content script for Zillow pages
- `background.js` - Background service worker
- `assets/popup.js` - Popup script

## Loading in Chrome

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or: Menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load Unpacked Extension**
   - Click "Load unpacked" button
   - Navigate to: `C:\Users\Ryan\Apps\Deal Analyzer\extension\dist`
   - Select the `dist` folder (not the parent `extension` folder)

4. **Verify Extension Loaded**
   - You should see "DealCheck" in your extensions list
   - The extension icon should appear in your Chrome toolbar

## Testing the Extension

### Prerequisites
- Your Next.js web app must be running on `http://localhost:3000`
- Start it with: `npm run dev` (from project root)

### Test Steps

1. **Navigate to a Zillow Listing**
   - Go to any Zillow property listing page
   - Example: `https://www.zillow.com/homedetails/...`

2. **Open Extension Popup**
   - Click the DealCheck extension icon in your Chrome toolbar
   - The popup should appear with "Import current Zillow listing" button

3. **Import Listing**
   - Click "Import current Zillow listing"
   - Watch for status messages:
     - "Extracting data..."
     - "Importing to DealCheck..."
     - "Success! Opening deal..."

4. **Verify Results**
   - A new tab should open with the deal page
   - The deal should appear in your dashboard

## Debugging

### Popup Console
- Right-click extension icon → "Inspect popup"
- Check Console tab for errors

### Content Script Console
- On Zillow page, press F12 to open DevTools
- Check Console tab for content script messages

### Background Worker Console
- Go to `chrome://extensions/`
- Find DealCheck extension
- Click "service worker" link (if available)

### Network Requests
- In popup DevTools, check Network tab
- Verify POST request to `http://localhost:3000/api/import`

## Common Issues

**"Could not access current tab"**
- Make sure you're on a `zillow.com` page
- Check extension has `activeTab` permission

**"Failed to extract data"**
- Open Zillow page DevTools → Console
- Check for content script errors
- Verify content script is injected

**"Failed to import listing"**
- Verify web app is running: `http://localhost:3000`
- Check browser console for CORS errors
- Test API endpoint manually if needed

**Extension icon missing**
- This is normal - we removed icon references from manifest
- Extension will still work without icons

## Development Workflow

For active development, use watch mode:

```bash
cd extension
npm run dev
```

After making changes:
1. Wait for rebuild (watch mode)
2. Go to `chrome://extensions/`
3. Click reload icon on DealCheck extension
4. Test again

## Next Steps

- Add extension icons (16x16, 48x48, 128x128 PNG files in `icons/`)
- Update manifest.json to reference icons
- Test on various Zillow listing pages
- Verify all data extraction layers work
