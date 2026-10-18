import { NextRequest, NextResponse } from 'next/server';
import { buildMicrosoftAuthUrl, isMicrosoftOAuthConfigured, resolveMicrosoftRedirectUri } from '@/lib/microsoft/auth';
import { encryptPayload } from '@/lib/auth/crypto';

export async function GET(request: NextRequest) {
  if (!isMicrosoftOAuthConfigured()) {
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/en/calendar';
    const url = new URL(returnTo, request.url);
    url.searchParams.set('microsoft_error', 'not_configured');
    return NextResponse.redirect(url);
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const requestOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin;
  const redirectUri = resolveMicrosoftRedirectUri(requestOrigin);

  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/en/calendar';
  const statePayload = {
    returnTo,
    redirectUri,
    nonce: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  const stateToken = encryptPayload(statePayload, 'microsoft-oauth-state');
  const authUrl = buildMicrosoftAuthUrl(stateToken, redirectUri);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('microsoft_oauth_state', stateToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return response;
}
