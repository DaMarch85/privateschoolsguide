These are the updated files only.

Copy them into the matching paths in your GitHub repo, commit, and deploy.

Manual step still needed outside code:
- Add a permanent redirect in Cloudflare from https://www.privateschoolguide.co.uk/* to https://privateschoolguide.co.uk/:splat (preserve path and query string).

Main code changes included here:
- non-www canonical/site URL alignment
- dynamic sitemap generation
- removal of mobile homepage redirects on location pages
- server-rendered school links on location landing pages
- duplicate location-specific school pages disabled
- compare URLs switched from query params to hash fragments
- robots/noindex support fixed for shortlist/admin/404 and empty open-days pages
- placeholder copy cleaned up on key pages
