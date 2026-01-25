# Starting the Development Server

## Quick Start

1. **Open a terminal in the project root:**
   ```
   cd "C:\Users\Ryan\Apps\Deal Analyzer"
   ```

2. **Start the server:**
   ```
   npm run dev
   ```

3. **Wait for compilation:**
   - You should see output like:
     ```
     ▲ Next.js 14.2.5
     - Local:        http://localhost:3000
     - Ready in 2.3s
     ```

4. **Open in browser:**
   - Navigate to: http://localhost:3000
   - It should automatically redirect to http://localhost:3000/dashboard

## Troubleshooting 404 Errors

If you get a 404 error:

1. **Check terminal output** - Look for compilation errors
2. **Wait for "Ready" message** - Server needs to compile first
3. **Try direct URL** - Go to http://localhost:3000/dashboard directly
4. **Clear .next cache:**
   ```
   Remove-Item -Path ".next" -Recurse -Force
   npm run dev
   ```

## Common Issues

- **"Port 3000 already in use"** - Kill existing node processes or use different port
- **Compilation errors** - Check terminal for TypeScript/import errors
- **404 on all routes** - Server may still be compiling, wait a bit longer
