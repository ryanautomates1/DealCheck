#!/bin/bash
# This script creates .env.production from Amplify environment variables
# Amplify injects variables differently for SSR apps

echo "Creating .env.production file..."

# Create .env.production with available environment variables
cat > .env.production << EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
USE_SUPABASE=${USE_SUPABASE}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-$STRIPE_PUBLISHABLE_KEY}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
STRIPE_PRO_PRICE_ID=${STRIPE_PRO_PRICE_ID:-$STRIPE_PRICE_ID}
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-https://getdealmetrics.com}
EOF

echo "=== .env.production contents (values hidden) ==="
cat .env.production | sed 's/=.*/=***HIDDEN***/'
echo "=== End of .env.production ==="
