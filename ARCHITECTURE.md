# DealMetrics Architecture

## Critical Constraint

**The web app MUST NOT fetch or scrape Zillow URLs.** All Zillow data extraction occurs ONLY in the Chrome extension running in the user's browser.

## System Flow

```
User Browser (Zillow Page)
    ↓
Chrome Extension (Content Script)
    ↓ Extracts data from DOM
Extension Popup
    ↓ POSTs structured payload
Web App API (/api/import)
    ↓ Creates/updates Deal
Web App Database (JSON files)
    ↓ Returns dealId
Extension opens /deals/{dealId}
```

## Data Extraction Layers

### Layer 1: Structured Data
- JSON-LD schemas (`application/ld+json`)
- Embedded page state objects
- Highest confidence

### Layer 2: Semantic DOM
- CSS selectors for known Zillow elements
- Text pattern matching (e.g., "Price: $250,000")
- Medium confidence

### Layer 3: Regex Fallback
- Pattern matching on visible text
- Currency patterns, numeric patterns
- Lowest confidence

## Data Models

### Deal
- Core property information
- Import metadata (status, fields)
- All deal inputs (purchase, loan, costs, income, assumptions)

### Analysis
- Versioned analysis records
- Inputs snapshot
- Calculated outputs
- Timestamp

### ShareLink
- Token-based sharing
- Revocable
- Read-only access

### ImportLog
- Tracks all imports
- Result status
- Extractor version used

## Repositories

All data access goes through repository interfaces:
- `DealRepository`
- `AnalysisRepository`
- `ShareRepository`
- `ImportLogRepository`

Current implementation: JSON file-based with file locking for concurrency.

## Underwriting Engine

Server-side calculations:
- Amortization formulas
- NOI, cash flow, cap rate
- Cash-on-cash, DSCR
- Break-even rent
- All-in cash required

All calculations are unit tested.

## API Routes

- `POST /api/import` - Extension payload endpoint
- `GET /api/deals` - List deals
- `POST /api/deals` - Manual creation
- `GET /api/deals/[id]` - Get deal
- `PUT /api/deals/[id]` - Update deal
- `POST /api/deals/[id]/analyze` - Run analysis
- `POST /api/deals/[id]/share` - Create share link
- `GET /api/share/[token]` - Get shared deal

## Extension Architecture

### Content Script (`content.ts`)
- Runs on Zillow pages
- Extracts data using layered approach
- Responds to messages from popup

### Popup (`popup.ts`)
- UI for user interaction
- Communicates with content script
- POSTs to web app API
- Opens deal page on success

### Background Worker (`background.ts`)
- Service worker for extension
- Handles messages if needed

## Future Migration Path

The architecture is designed for easy migration:
- Repository interfaces allow swapping JSON files for database
- `getCurrentUserId()` can be replaced with real auth
- Extension can be enhanced with more extraction layers
- Analysis engine can be extended with more calculations
