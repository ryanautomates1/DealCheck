import { NextResponse } from 'next/server'

const isProd = process.env.NODE_ENV === 'production'

/**
 * Return a JSON error response. In production, uses only the generic message;
 * in development, can include step/type/details. Always logs full context server-side.
 */
export function apiErrorResponse(
  genericMessage: string,
  status: number,
  context?: { details?: unknown; step?: string; type?: string }
): NextResponse {
  console.error('[API Error]', genericMessage, context ?? '')
  const body: Record<string, unknown> = { error: genericMessage }
  if (!isProd && context) {
    if (context.step) body.step = context.step
    if (context.type) body.type = context.type
    if (context.details !== undefined) body.details = context.details
  }
  return NextResponse.json(body, { status })
}
