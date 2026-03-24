Drop this file into your repo root.

What it fixes:
- school profile routes were only being generated for a partial subset of schools because getAllLocationSchoolPaths() was querying more than the Supabase API row cap in one request.
- the fix pages through location_schools and chunks school slug lookups, so all linked school pages get generated.
