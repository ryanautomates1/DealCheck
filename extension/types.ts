// Shared types for extension
export type ExtractorVersion = 'structured_v1' | 'semantic_v1' | 'regex_v1'

export interface ExtensionImportPayload {
  zillowUrl: string
  extractedData: {
    address?: string
    city?: string
    state?: string
    zip?: string
    propertyType?: string
    beds?: number
    baths?: number
    sqft?: number
    yearBuilt?: number
    listPrice?: number
    hoaMonthly?: number
    taxesAnnual?: number
  }
  importedFields: string[]
  missingFields: string[]
  extractorVersion: ExtractorVersion
}
