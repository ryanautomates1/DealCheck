/**
 * Escape a string for safe use in HTML (e.g. innerHTML, attribute values).
 * Prevents XSS when interpolating scraped or user-controlled data.
 */
export function escapeHtml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return ''
  const s = String(str)
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
