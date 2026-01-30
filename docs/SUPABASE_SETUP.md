# Supabase setup for DealMetrics

If sign-in times out or shows "Cannot reach Supabase", check the following in your [Supabase Dashboard](https://supabase.com/dashboard).

## 1. Resume project (most common fix)

Free-tier projects **pause after ~1 week of inactivity**. When paused, auth requests hang or time out.

- Go to **Project Settings** (gear icon) → **General**
- If you see **"Project is paused"**, click **"Resume project"**
- Wait a minute, then try sign-in again

## 2. Auth → Email provider

- Go to **Authentication** → **Providers**
- Ensure **Email** is enabled
- No extra config needed for email/password sign-in

## 3. Project URL and keys

- **Project Settings** → **API**
- Use **Project URL** as `NEXT_PUBLIC_SUPABASE_URL`
- Use **anon public** key as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Use **service_role** key as `SUPABASE_SERVICE_ROLE_KEY` (server/env only, never in client)

## 4. Region / latency

If the project is in a region far from your users, auth can be slow (10–30+ seconds). The app allows up to 45 seconds and shows "This may take 10–30 seconds." Consider creating a project in a closer region if needed.
