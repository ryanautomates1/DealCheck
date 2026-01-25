import { ExtractorVersion } from '../../types'

export interface ExtractedField {
  value: any
  confidence: number
  source: string
}

export interface ExtractionResult {
  fields: Record<string, ExtractedField>
  extractorVersion: ExtractorVersion
}

/**
 * Layer 1: Extract from structured data (JSON-LD)
 */
export function extractFromStructuredData(): Record<string, ExtractedField> {
  const fields: Record<string, ExtractedField> = {}
  
  try {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]')
    jsonLdScripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent || '{}')
        
        // Look for RealEstateAgent, Product, Place, or Offer schema
        if (data['@type'] === 'RealEstateAgent' || data['@type'] === 'Product' || data['@type'] === 'Place' || data['@type'] === 'Offer') {
          if (data.address) {
            const addr = typeof data.address === 'string' ? data.address : data.address.streetAddress
            if (addr && !fields.address) {
              fields.address = { value: addr, confidence: 0.9, source: 'json-ld' }
            }
          }
          
          // Check offers.price
          if (data.offers?.price && !fields.listPrice) {
            const price = typeof data.offers.price === 'number' ? data.offers.price : parseFloat(data.offers.price)
            if (price > 10000 && price < 10000000) {
              fields.listPrice = { value: price, confidence: 0.9, source: 'json-ld' }
            }
          }
          
          // Check price directly
          if (data.price && !fields.listPrice) {
            const price = typeof data.price === 'number' ? data.price : parseFloat(data.price)
            if (price > 10000 && price < 10000000) {
              fields.listPrice = { value: price, confidence: 0.9, source: 'json-ld' }
            }
          }
        }
        
        // Also check for nested structures (@graph)
        if (data['@graph'] && Array.isArray(data['@graph'])) {
          for (const item of data['@graph']) {
            if (item['@type'] === 'Product' || item['@type'] === 'Offer') {
              if (item.offers?.price && !fields.listPrice) {
                const price = typeof item.offers.price === 'number' ? item.offers.price : parseFloat(item.offers.price)
                if (price > 10000 && price < 10000000) {
                  fields.listPrice = { value: price, confidence: 0.9, source: 'json-ld' }
                }
              }
              if (item.price && !fields.listPrice) {
                const price = typeof item.price === 'number' ? item.price : parseFloat(item.price)
                if (price > 10000 && price < 10000000) {
                  fields.listPrice = { value: price, confidence: 0.9, source: 'json-ld' }
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    })
  } catch (e) {
    // JSON-LD extraction failed
  }
  
  return fields
}

/**
 * Layer 2: Extract using semantic DOM heuristics
 */
export function extractFromSemanticDOM(): Record<string, ExtractedField> {
  const fields: Record<string, ExtractedField> = {}
  const text = document.body.innerText.toLowerCase()
  
  // Extract address from common selectors
  const addressSelectors = [
    'h1[data-test="property-title"]',
    '[data-testid="property-address"]',
    '.ds-address-container',
    'h1.address',
    '[class*="address"]',
    'h1[class*="address"]',
    '.property-address',
    '[data-test="property-address"]',
    'h1',
    'h2',
  ]
  
  for (const selector of addressSelectors) {
    const elements = document.querySelectorAll(selector)
    for (const element of Array.from(elements)) {
      if (!fields.address) {
        const address = element.textContent?.trim()
        // Check if it looks like an address (has numbers and street-like words)
        if (address && address.length > 10 && /\d/.test(address) && 
            (address.includes('St') || address.includes('Street') || address.includes('Ave') || 
             address.includes('Avenue') || address.includes('Rd') || address.includes('Road') ||
             address.includes('Dr') || address.includes('Drive') || address.includes('Ln') ||
             address.includes('Lane') || address.includes('Blvd') || address.includes('Boulevard') ||
             /,\s*[A-Z]{2}\s+\d{5}/.test(address))) {
          fields.address = { value: address, confidence: 0.85, source: 'semantic-dom' }
          break
        }
      }
    }
    if (fields.address) break
  }
  
  // Fallback: Look for address pattern in page text
  if (!fields.address) {
    const addressPattern = /(\d+\s+[A-Za-z\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard|Ct|Court|Pl|Place|Way|Cir|Circle)[^,]*,\s*[A-Z]{2}\s+\d{5})/i
    const match = document.body.innerText.match(addressPattern)
    if (match) {
      fields.address = { value: match[1].trim(), confidence: 0.7, source: 'semantic-dom' }
    }
  }
  
  // ============================================================================
  // SIMPLIFIED PRICE EXTRACTION
  // The list price is ALWAYS displayed near the address in Zillow's header area.
  // Since address extraction works, we use it as an anchor to find the price.
  // ============================================================================
  
  // Helper: Find the smallest element containing specific text
  const findExactElement = (searchText: string): Element | null => {
    // Look for elements where the text content closely matches (not a parent with lots of extra text)
    const candidates: Element[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
    let node: Node | null = walker.currentNode
    
    while (node) {
      const el = node as Element
      const text = el.textContent?.trim() || ''
      
      // Check if this element's text matches and is reasonably short (not a huge container)
      if (text.includes(searchText) && text.length < searchText.length + 100) {
        candidates.push(el)
      }
      node = walker.nextNode()
    }
    
    // Return the smallest (most specific) matching element
    if (candidates.length > 0) {
      return candidates.sort((a, b) => 
        (a.textContent?.length || 0) - (b.textContent?.length || 0)
      )[0]
    }
    return null
  }
  
  // Helper: Extract first valid price from text (excluding Zestimate context)
  const extractPriceFromText = (text: string): number | null => {
    // Split by "zestimate" to only look at content before it
    const beforeZestimate = text.toLowerCase().split('zestimate')[0]
    const priceMatch = beforeZestimate.match(/\$([1-9]\d{0,2}(?:,\d{3})+)/)
    if (priceMatch) {
      const price = parseInt(priceMatch[1].replace(/,/g, ''), 10)
      if (price >= 50000 && price <= 50000000) {
        return price
      }
    }
    return null
  }
  
  // STRATEGY: Use address element as anchor, find price in same visual block
  if (fields.address && !fields.listPrice) {
    const addressText = fields.address.value
    const addressElement = findExactElement(addressText)
    
    if (addressElement) {
      console.log('[DealCheck] Found address element:', addressElement.tagName, addressElement.className)
      
      // Walk up the DOM to find a container that has BOTH the address AND a price
      let container: Element | null = addressElement
      let depth = 0
      
      while (container && depth < 8) {
        const containerText = container.textContent || ''
        const price = extractPriceFromText(containerText)
        
        if (price) {
          // Make sure this container doesn't include too much (like the whole page)
          // The header block with price + address is usually < 500 chars
          if (containerText.length < 1000) {
            fields.listPrice = { value: price, confidence: 0.98, source: 'semantic-dom' }
            console.log('[DealCheck] Found price in address container:', price)
            break
          }
        }
        
        container = container.parentElement
        depth++
      }
    }
  }
  
  // FALLBACK: Look for prominent price in page header (h1/h2 with $ before "zestimate")
  if (!fields.listPrice) {
    const pageText = document.body.innerText
    const price = extractPriceFromText(pageText)
    if (price) {
      fields.listPrice = { value: price, confidence: 0.7, source: 'semantic-dom' }
      console.log('[DealCheck] Found price via fallback text search:', price)
    }
  }
  
  // Extract beds
  const bedsPatterns = [
    /(\d+)\s*(?:bed|bedroom)/i,
    /bedrooms?[:\s]*(\d+)/i,
  ]
  
  for (const pattern of bedsPatterns) {
    const match = text.match(pattern)
    if (match && !fields.beds) {
      const beds = parseInt(match[1], 10)
      if (beds >= 0 && beds <= 20) {
        fields.beds = { value: beds, confidence: 0.7, source: 'semantic-dom' }
        break
      }
    }
  }
  
  // Extract baths
  const bathsPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:bath|bathroom)/i,
    /bathrooms?[:\s]*(\d+(?:\.\d+)?)/i,
  ]
  
  for (const pattern of bathsPatterns) {
    const match = text.match(pattern)
    if (match && !fields.baths) {
      const baths = parseFloat(match[1])
      if (baths >= 0 && baths <= 20) {
        fields.baths = { value: baths, confidence: 0.7, source: 'semantic-dom' }
        break
      }
    }
  }
  
  // Extract sqft
  const sqftPatterns = [
    /(\d{1,3}(?:,\d{3})*)\s*(?:sqft|sq\.?\s*ft|square\s*feet)/i,
    /(\d{1,3}(?:,\d{3})*)\s*(?:sq|ft²)/i,
  ]
  
  for (const pattern of sqftPatterns) {
    const match = text.match(pattern)
    if (match && !fields.sqft) {
      const sqft = parseInt(match[1].replace(/,/g, ''), 10)
      if (sqft >= 100 && sqft <= 50000) {
        fields.sqft = { value: sqft, confidence: 0.7, source: 'semantic-dom' }
        break
      }
    }
  }
  
  // Extract HOA
  const hoaPatterns = [
    /hoa[:\s]*\$?([\d,]+)\s*(?:per\s*month|monthly|mo)/i,
    /monthly\s*hoa[:\s]*\$?([\d,]+)/i,
  ]
  
  for (const pattern of hoaPatterns) {
    const match = text.match(pattern)
    if (match && !fields.hoaMonthly) {
      const hoa = parseInt(match[1].replace(/,/g, ''), 10)
      if (hoa >= 0 && hoa <= 10000) {
        fields.hoaMonthly = { value: hoa, confidence: 0.6, source: 'semantic-dom' }
        break
      }
    }
  }
  
  // Extract taxes
  const taxPatterns = [
    /(?:annual|yearly)\s*tax[:\s]*\$?([\d,]+)/i,
    /taxes?[:\s]*\$?([\d,]+)\s*(?:per\s*year|annually)/i,
  ]
  
  for (const pattern of taxPatterns) {
    const match = text.match(pattern)
    if (match && !fields.taxesAnnual) {
      const tax = parseInt(match[1].replace(/,/g, ''), 10)
      if (tax >= 0 && tax <= 100000) {
        fields.taxesAnnual = { value: tax, confidence: 0.6, source: 'semantic-dom' }
        break
      }
    }
  }
  
  // Extract property type
  const propertyTypePatterns = [
    /(single\s*family|condo|condominium|townhouse|townhome|multi-family)/i,
  ]
  
  for (const pattern of propertyTypePatterns) {
    const match = text.match(pattern)
    if (match && !fields.propertyType) {
      let propType = match[1].toLowerCase()
      if (propType.includes('single family')) propType = 'Single Family'
      else if (propType.includes('condo')) propType = 'Condo'
      else if (propType.includes('town')) propType = 'Townhouse'
      else if (propType.includes('multi')) propType = 'Multi-Family'
      
      fields.propertyType = { value: propType, confidence: 0.6, source: 'semantic-dom' }
      break
    }
  }
  
  // Extract year built
  const yearPatterns = [
    /built[:\s]*(\d{4})/i,
    /year\s*built[:\s]*(\d{4})/i,
    /(\d{4})\s*(?:built|constructed)/i,
  ]
  
  for (const pattern of yearPatterns) {
    const match = text.match(pattern)
    if (match && !fields.yearBuilt) {
      const year = parseInt(match[1], 10)
      if (year >= 1800 && year <= new Date().getFullYear() + 1) {
        fields.yearBuilt = { value: year, confidence: 0.6, source: 'semantic-dom' }
        break
      }
    }
  }
  
  return fields
}

/**
 * Layer 3: Fallback regex parsing on visible text
 */
export function extractFromRegex(text: string): Record<string, ExtractedField> {
  const fields: Record<string, ExtractedField> = {}
  const lowerText = text.toLowerCase()
  
  // Currency patterns - only as last resort, and be more selective
  if (!fields.listPrice) {
    // Look for prices near "price", "list", "asking" keywords
    const priceContextPattern = /(?:price|list|asking)[^$]*\$([\d,]+)/gi
    const prices: Array<{ price: number; context: string }> = []
    let match
    
    while ((match = priceContextPattern.exec(text)) !== null) {
      const price = parseInt(match[1].replace(/,/g, ''), 10)
      if (price > 10000 && price < 10000000) {
        prices.push({ price, context: match[0].substring(0, 50) })
      }
    }
    
    if (prices.length > 0) {
      // Prefer prices that appear first (usually the main listing price)
      // or have "list" or "asking" in context
      const preferredPrice = prices.find(p => 
        p.context.toLowerCase().includes('list') || 
        p.context.toLowerCase().includes('asking')
      ) || prices[0]
      
      fields.listPrice = { 
        value: preferredPrice.price, 
        confidence: 0.4, 
        source: 'regex' 
      }
    }
  }
  
  return fields
}

/**
 * Main extraction function - combines all layers
 */
export function extractZillowData(): ExtractionResult {
  const allFields: Record<string, ExtractedField> = {}
  
  // Layer 1: Structured data (highest confidence)
  const structuredFields = extractFromStructuredData()
  Object.assign(allFields, structuredFields)
  
  // Layer 2: Semantic DOM (medium confidence)
  const semanticFields = extractFromSemanticDOM()
  for (const [key, field] of Object.entries(semanticFields)) {
    if (!allFields[key] || field.confidence > allFields[key].confidence) {
      allFields[key] = field
    }
  }
  
  // Layer 3: Regex fallback (lowest confidence)
  const regexFields = extractFromRegex(document.body.innerText)
  for (const [key, field] of Object.entries(regexFields)) {
    if (!allFields[key] || field.confidence > allFields[key].confidence) {
      allFields[key] = field
    }
  }
  
  // Extract address components if we have a full address
  if (allFields.address) {
    const addressParts = parseAddress(allFields.address.value)
    if (addressParts.city && !allFields.city) {
      allFields.city = { value: addressParts.city, confidence: 0.7, source: 'parsed' }
    }
    if (addressParts.state && !allFields.state) {
      allFields.state = { value: addressParts.state, confidence: 0.7, source: 'parsed' }
    }
    if (addressParts.zip && !allFields.zip) {
      allFields.zip = { value: addressParts.zip, confidence: 0.7, source: 'parsed' }
    }
  }
  
  // Determine extractor version based on what was used
  let extractorVersion: ExtractorVersion = 'regex_v1'
  if (Object.keys(structuredFields).length > 0) {
    extractorVersion = 'structured_v1'
  } else if (Object.keys(semanticFields).length > 0) {
    extractorVersion = 'semantic_v1'
  }
  
  return {
    fields: allFields,
    extractorVersion,
  }
}

function parseAddress(address: string): { city?: string; state?: string; zip?: string } {
  const parts: { city?: string; state?: string; zip?: string } = {}
  
  // Try to parse "City, ST 12345" format
  const cityStateZip = address.match(/([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/)
  if (cityStateZip) {
    parts.city = cityStateZip[1].trim()
    parts.state = cityStateZip[2]
    parts.zip = cityStateZip[3]
  } else {
    // Try just state and zip
    const stateZip = address.match(/([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/)
    if (stateZip) {
      parts.state = stateZip[1]
      parts.zip = stateZip[2]
    }
  }
  
  return parts
}
