/**
 * Floating button that appears on Zillow listing pages
 * Toggles the analysis sidebar when clicked
 */

let sidebarVisible = false
let sidebarContainer: HTMLElement | null = null

// Check if current page is a Zillow listing detail page
export function isZillowListingPage(): boolean {
  const url = window.location.href
  return url.includes('zillow.com/homedetails/') || 
         url.includes('zillow.com/homes/') && url.includes('_zpid')
}

// Create and inject the floating button
export function createFloatingButton(onToggle: () => void): HTMLElement {
  const button = document.createElement('button')
  button.id = 'dealmetrics-floating-btn'
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
    <span>Analyze</span>
  `
  
  // Styles for the floating button
  button.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483646;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border: none;
    border-radius: 50px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  `
  
  // Hover effects
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.05)'
    button.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5), 0 4px 10px rgba(0, 0, 0, 0.15)'
  })
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)'
    button.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1)'
  })
  
  button.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onToggle()
  })
  
  return button
}

// Update button appearance when sidebar is open/closed
export function updateButtonState(button: HTMLElement, isOpen: boolean): void {
  const span = button.querySelector('span')
  if (span) {
    span.textContent = isOpen ? 'Close' : 'Analyze'
  }
  
  if (isOpen) {
    button.style.background = 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
    button.style.boxShadow = '0 4px 14px rgba(100, 116, 139, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1)'
  } else {
    button.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
    button.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1)'
  }
}

// Inject button into page
export function injectFloatingButton(onToggle: () => void): HTMLElement | null {
  // Don't inject if already exists
  if (document.getElementById('dealmetrics-floating-btn')) {
    return document.getElementById('dealmetrics-floating-btn')
  }
  
  // Only inject on listing pages
  if (!isZillowListingPage()) {
    return null
  }
  
  const button = createFloatingButton(onToggle)
  document.body.appendChild(button)
  
  return button
}

// Remove button from page
export function removeFloatingButton(): void {
  const button = document.getElementById('dealmetrics-floating-btn')
  if (button) {
    button.remove()
  }
}
