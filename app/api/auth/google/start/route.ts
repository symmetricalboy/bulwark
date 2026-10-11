import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl, getGoogleConfig } from '@/lib/google/auth';
import { generateUUID } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { isConfigured } = getGoogleConfig();
  if (!isConfigured) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local' },
      { status: 503 },
    );
  }

  let returnTo = request.nextUrl.searchParams.get('returnTo');
  if (!returnTo) {
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.pathname.startsWith('/')) {
          returnTo = `${refUrl.pathname}${refUrl.search}`;
        }
      } catch {
        // ignore malformed referer
      }
    }
  }
  if (!returnTo) {
    returnTo = '/calendar';
  }

  const loginHint =
    request.nextUrl.searchParams.get('login_hint') ||
    request.nextUrl.searchParams.get('email') ||
    undefined;

  const comailAccountId = request.nextUrl.searchParams.get('comailAccountId') || undefined;
  const comailAccountEmail = request.nextUrl.searchParams.get('comailAccountEmail') || undefined;

  const state = JSON.stringify({
    nonce: generateUUID(),
    returnTo,
    comailAccountId,
    comailAccountEmail,
  });
  const authUrl = getGoogleAuthUrl(Buffer.from(state).toString('base64url'), { loginHint });

  return NextResponse.redirect(authUrl);
}
