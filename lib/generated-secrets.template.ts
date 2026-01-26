// Template for local development
// Copy this to lib/generated-secrets.ts and fill in your values
// OR run: node scripts/generate-secrets.js (with env vars set)

export const GENERATED_SECRETS = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID || '',
};
