import { extractZillowData } from './extractors'

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    try {
      // Check if we're on a Zillow listing page
      if (!window.location.hostname.includes('zillow.com')) {
        sendResponse({
          success: false,
          error: 'Not on a Zillow page',
        })
        return true
      }
      
      // Extract data
      const result = extractZillowData()
      
      // Prepare payload with confidence scores
      const extractedData: Record<string, any> = {}
      const importedFields: string[] = []
      const fieldConfidences: Record<string, number> = {}
      
      for (const [key, field] of Object.entries(result.fields)) {
        if (field.value !== undefined && field.value !== null) {
          extractedData[key] = field.value
          importedFields.push(key)
          fieldConfidences[key] = field.confidence
        }
      }
      
      const missingFields: string[] = []
      const requiredFields = ['address', 'listPrice', 'beds', 'baths', 'sqft']
      for (const field of requiredFields) {
        if (!importedFields.includes(field)) {
          missingFields.push(field)
        }
      }
      
      sendResponse({
        success: true,
        payload: {
          zillowUrl: window.location.href,
          extractedData,
          importedFields,
          missingFields,
          fieldConfidences,
          extractorVersion: result.extractorVersion,
        },
      })
    } catch (error: any) {
      sendResponse({
        success: false,
        error: error.message || 'Extraction failed',
      })
    }
    
    return true // Keep channel open for async response
  }
})
