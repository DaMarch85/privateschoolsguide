import { jsonResponse } from './cors.ts';

function getTokenFromRequest(request: Request): string {
  const directHeader = String(request.headers.get('x-admin-review-token') || '').trim();
  if (directHeader) return directHeader;

  const authorization = String(request.headers.get('authorization') || '').trim();
  if (/^bearer\s+/i.test(authorization)) {
    return authorization.replace(/^bearer\s+/i, '').trim();
  }

  return '';
}

export function assertAdminReviewToken(request: Request) {
  const expected = String(Deno.env.get('ADMIN_REVIEW_TOKEN') || '').trim();
  if (!expected) {
    throw jsonResponse({ error: 'ADMIN_REVIEW_TOKEN is not configured.' }, { status: 500 });
  }

  const provided = getTokenFromRequest(request);
  if (!provided || provided !== expected) {
    throw jsonResponse({ error: 'Unauthorized.' }, { status: 401 });
  }
}
