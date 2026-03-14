# Astro migration starter for The Private School Guide

This starter was generated against the uploaded GitHub ZIP and is designed to let you migrate safely in parallel.

## What this adds

- Astro project files at repo root
- Build-time generated Astro routes for:
  - `/`
  - `/bath/`
  - `/bath/compare/`
  - `/bath/schools/[slug]/`
- A `prepare-public` script that copies the current legacy static assets and non-Bath pages into `public/` before each Astro build
- A first Supabase migration SQL file for the scalable schema

## Why this shape

This keeps the current live-site assets and placeholder pages available while you migrate Bath first.

## First local run

1. Put these files into the root of your existing repo.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the local Astro site.

## Current data source

Bath is powered by local mock data extracted from the current HTML and JS files in the uploaded repo.

That means the Astro version preserves the current Bath content shape while we prepare the Supabase data layer.

## Next technical step after this scaffold

Replace the local JSON data imports with a Supabase-backed build-time data layer.

## Important note

The SQL migration assumes your existing `schools.id` is a UUID. If your current `schools.id` is `bigint`, change the foreign-key column types before running the migration.
