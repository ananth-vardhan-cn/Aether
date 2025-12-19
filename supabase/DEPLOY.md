# Supabase Edge Function Deployment Guide

## Prerequisites

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```
(Find your project ref in Supabase Dashboard URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`)

## Deploy the Edge Function

```bash
cd e:\app_builder_1
supabase functions deploy generate-app
```

## Set the API Key Secret

```bash
supabase secrets set GEMINI_API_KEY=your-actual-gemini-api-key
```

## Verify Deployment

1. Go to Supabase Dashboard → Edge Functions
2. You should see `generate-app` function listed
3. Check logs for any errors

## Update .env.local

After deployment, you can remove `GEMINI_API_KEY` from `.env.local` since it's now stored in Supabase secrets.

Your `.env.local` only needs:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Testing

1. Restart your dev server: `npm run dev`
2. Sign in to Aether
3. Create a new project or generate an app
4. Check the Network tab - requests should go to Supabase Edge Function, not directly to Gemini

## Troubleshooting

**Error: "You must be signed in to generate apps"**
- Make sure you're signed in before generating

**Error: "API key not configured"**
- Run `supabase secrets set GEMINI_API_KEY=your-key` again

**Error: "Function not found"**
- Run `supabase functions deploy generate-app` again
