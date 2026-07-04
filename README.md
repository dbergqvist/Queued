# Queued

A personal queue for books, movies, TV series, and music.

## Stack

- SvelteKit
- TypeScript
- Tailwind CSS
- Supabase Auth, PostgREST, Postgres, and RLS
- Cloud Run-ready Node adapter build

## Local Setup

Install dependencies:

```sh
npm install
```

Create `.env.local`:

```env
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Run the app:

```sh
npm run dev
```

## Supabase

Apply migrations:

```sh
npx supabase link --project-ref rmnvcntylbfybzfpklxe
npx supabase db push
```

Regenerate database types after schema changes:

```sh
npx supabase gen types typescript --project-id rmnvcntylbfybzfpklxe > src/lib/database.types.ts
```

## Validation

```sh
npm run check
npm test
npm run build
```

## Cloud Run

The container expects these environment variables:

```env
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Build locally:

```sh
docker build -t queued .
```

Run locally:

```sh
docker run --env-file .env.local -p 3000:3000 queued
```

Deploy with Google Cloud:

```sh
gcloud run deploy queued \
  --source . \
  --region europe-north1 \
  --allow-unauthenticated \
  --set-env-vars PUBLIC_SUPABASE_URL="$PUBLIC_SUPABASE_URL",PUBLIC_SUPABASE_ANON_KEY="$PUBLIC_SUPABASE_ANON_KEY"
```

After deploying, add the Cloud Run URL to Supabase:

```text
Authentication -> URL Configuration -> Redirect URLs
```

Add:

```text
https://your-cloud-run-url
https://your-cloud-run-url/**
```
