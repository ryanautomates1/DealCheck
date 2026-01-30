# Supabase setup for DealMetrics

If sign-in fails, times out, or shows "Cannot reach Supabase", check the following in your [Supabase Dashboard](https://supabase.com/dashboard).

## 1. Resume project

Free-tier projects **pause after ~1 week of inactivity**. When paused, auth requests hang or time out.

- **Project Settings** (gear) → **General**
- If you see **"Project is paused"**, click **"Resume project"** and wait ~1 minute

## 2. Auth → URL Configuration (often the cause when project is not paused)

Wrong **Site URL** can cause auth to fail or hang.

- Go to **Authentication** → **URL Configuration**
- Set **Site URL** to your app’s public URL, e.g. `https://getdealmetrics.com` (no trailing slash)
- Under **Redirect URLs**, add:
  - `https://getdealmetrics.com/**`
  - `http://localhost:3000/**` for local dev
- Save

## 3. Auth → Providers → Email

- **Authentication** → **Providers**
- Ensure **Email** is enabled
- If **"Confirm email"** is enabled, users must confirm their email before sign-in works (check the inbox or Supabase Auth → Users for confirmation status)

## 4. Project URL and keys

- **Project Settings** → **API**
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server/env only, never in client)

## 5. Region / latency

If the project is in a region far from your users, auth can be slow. The app uses a 25s timeout for the sign-in request. Consider a project in a closer region if timeouts persist.
