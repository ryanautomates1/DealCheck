# DealCheck - Real Estate Deal Analyzer

A Next.js 14 web application + Chrome extension for analyzing residential real estate deals.

## Architecture

**CRITICAL**: The web app does NOT fetch or scrape Zillow URLs. All Zillow data extraction happens ONLY in the Chrome extension running in the user's browser.

### Flow

1. User opens Zillow listing in browser
2. User clicks Chrome extension: "Import to DealCheck"
3. Extension extracts data from the page
4. Extension POSTs structured payload to web app API
5. Web app creates/updates Deal
6. Extension opens deal page in new tab

## Tech Stack

- **Web App**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Extension**: Chrome Manifest V3 + TypeScript + Vite
- **Validation**: Zod
- **Testing**: Vitest
- **Persistence**: Local JSON files (no external database)

## Features

- **Chrome Extension**: Extract property data from Zillow listings
- **Dashboard**: View all deals with search
- **Manual Deal Creation**: Create deals without importing
- **Deal Analysis**: Comprehensive underwriting calculations
- **Share Links**: Share read-only deal reports
- **Import Logging**: Track all imports

## Getting Started

### Web App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Chrome Extension

```bash
cd extension
npm install
npm run build
```

Then load the `extension/dist` directory in Chrome as an unpacked extension.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard page
│   ├── deals/             # Deal pages
│   └── share/             # Share pages
├── extension/              # Chrome extension
│   ├── src/
│   │   ├── content/       # Content script (data extraction)
│   │   ├── popup/         # Extension popup UI
│   │   └── background/    # Background worker
│   └── manifest.json
├── lib/
│   ├── underwriting/      # Analysis engine
│   ├── repositories/      # Data repositories
│   └── types.ts           # TypeScript types
└── data/                   # JSON file storage
```

## Data Extraction

The extension uses a layered approach:

1. **Structured Data**: JSON-LD schemas
2. **Semantic DOM**: CSS selectors and text patterns
3. **Regex Fallback**: Pattern matching on visible text

## Underwriting Calculations

- Monthly P&I payment
- Net Operating Income (NOI)
- Cash flow
- Cap rate
- Cash-on-cash return
- Debt Service Coverage Ratio (DSCR)
- Break-even rent
- All-in cash required

## API Routes

- `POST /api/import` - Accept extension payload
- `GET /api/deals` - List deals
- `POST /api/deals` - Create manual deal
- `GET /api/deals/[id]` - Get deal
- `PUT /api/deals/[id]` - Update deal
- `POST /api/deals/[id]/analyze` - Run analysis
- `POST /api/deals/[id]/share` - Create share link
- `GET /api/share/[token]` - Get shared deal

## Testing

```bash
npm test
```

## Next Steps

- Add user authentication
- Migrate to production database
- Add sensitivity analysis grid
- Add charts and visualizations
- Add rate limiting
