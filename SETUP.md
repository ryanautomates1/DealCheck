# DealMetrics Setup Guide

This guide walks you through setting up Supabase authentication and Stripe payments for DealMetrics.

## Prerequisites

- Node.js 18+ installed
- npm installed
- Chrome browser (for extension testing)

## Quick Start (Local Development Mode)

For local development without Supabase/Stripe, you can run immediately:

```bash
npm install
npm run dev
```

The app will use local JSON file storage and skip authentication. To enable Supabase/Stripe, follow the steps below.

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Name it **"DealMetrics"** (or your preference)
4. Set a strong database password (save it!)
5. Select the region closest to you
6. Wait ~2 minutes for provisioning

### Get API Keys

1. Go to **Project Settings > API**
2. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...`
   - **service_role key**: `eyJhbGc...` (keep this secret!)

### Configure Authentication

1. Go to **Authentication > Providers**
2. Ensure **"Email"** is enabled
3. Go to **Authentication > URL Configuration**
4. Set **Site URL**: `http://localhost:3000`
5. Add **Redirect URL**: `http://localhost:3000/auth/callback`

### Create Database Tables

1. Go to **SQL Editor** in the left sidebar
2. Click **"New Query"**
3. Paste the entire SQL from the section below and click **"Run"**

```sql
-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  imports_this_month INTEGER DEFAULT 0,
  imports_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deals table
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  zillow_url TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  property_type TEXT,
  beds INTEGER,
  baths NUMERIC,
  sqft INTEGER,
  year_built INTEGER,
  list_price NUMERIC,
  hoa_monthly NUMERIC,
  taxes_annual NUMERIC,
  import_status TEXT DEFAULT 'manual',
  imported_fields TEXT[] DEFAULT '{}',
  missing_fields TEXT[] DEFAULT '{}',
  field_confidences JSONB DEFAULT '{}',
  assumed_fields TEXT[] DEFAULT '{}',
  purchase_type TEXT,
  purchase_price NUMERIC,
  closing_cost_rate NUMERIC,
  rehab_cost NUMERIC,
  down_payment_pct NUMERIC,
  interest_rate NUMERIC,
  term_years INTEGER,
  pmi_enabled BOOLEAN DEFAULT false,
  pmi_monthly NUMERIC,
  insurance_annual NUMERIC,
  utilities_monthly NUMERIC,
  rent_monthly NUMERIC,
  other_income_monthly NUMERIC,
  number_of_units INTEGER,
  rent_per_unit NUMERIC,
  vacancy_rate_per_unit NUMERIC,
  vacancy_rate NUMERIC,
  maintenance_rate NUMERIC,
  capex_rate NUMERIC,
  management_rate NUMERIC,
  holding_period_years INTEGER,
  appreciation_rate NUMERIC,
  rent_growth_rate NUMERIC,
  expense_growth_rate NUMERIC,
  selling_cost_rate NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analyses table
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  inputs JSONB NOT NULL,
  outputs JSONB NOT NULL,
  holding_period_outputs JSONB,
  assumptions_snapshot JSONB,
  version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Share links table
CREATE TABLE public.share_links (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Import logs table
CREATE TABLE public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  zillow_url TEXT NOT NULL,
  result TEXT NOT NULL,
  missing_fields_count INTEGER DEFAULT 0,
  extractor_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can CRUD own deals" ON public.deals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own analyses" ON public.analyses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own share links" ON public.share_links
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view non-revoked share links" ON public.share_links
  FOR SELECT USING (revoked = false);

CREATE POLICY "Users can CRUD own import logs" ON public.import_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.deals 
      WHERE deals.id = import_logs.deal_id 
      AND deals.user_id = auth.uid()
    )
  );

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON public.deals(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_deal_id ON public.analyses(deal_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);
```

---

## Step 2: Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. You can use **Test Mode** for development

### Get API Keys

1. Go to **Developers > API Keys**
2. Copy:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

### Create Product

1. Go to **Products > Add Product**
2. Name: **"DealMetrics Pro"**
3. Add Price: **$9.99/month** (recurring)
4. Copy the **Price ID**: `price_xxxxx`

### Set Up Webhook (for production)

1. Go to **Developers > Webhooks**
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy **Webhook signing secret**: `whsec_xxxxx`

For local development, you can use the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks.

---

## Step 3: Configure Environment Variables

Create a file named `.env.local` in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-key
STRIPE_SECRET_KEY=sk_test_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_PRO_PRICE_ID=price_your-price-id

# Enable Supabase mode (set to 'false' for local JSON storage)
USE_SUPABASE=true

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 4: Run the Application

```bash
npm install
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

---

## Step 5: Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (top right toggle)
3. Click **"Load unpacked"**
4. Select the `extension/dist` folder
5. The DealMetrics extension icon should appear in your toolbar

---

## Freemium Model

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Unlimited manual deals, 2 extension imports/month, full analysis |
| Pro | $9.99/mo | Unlimited imports, priority support |

---

## Troubleshooting

### "Unauthorized" errors
- Make sure you're signed in at http://localhost:3000/auth/login
- Check that `USE_SUPABASE=true` in your `.env.local`

### Extension not working
- Rebuild the extension: `cd extension && npm run build`
- Reload the extension in `chrome://extensions/`

### Database errors
- Make sure you ran the SQL script in Supabase SQL Editor
- Check that RLS policies are enabled
- Verify your Supabase keys are correct

### Stripe checkout not working
- Verify `STRIPE_PRO_PRICE_ID` matches your actual Price ID in Stripe
- Check Stripe Dashboard for any failed payments
