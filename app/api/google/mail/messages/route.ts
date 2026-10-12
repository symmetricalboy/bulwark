import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import { listGmailMessages, getGmailMessage } from '@/lib/google/gmail-api';
import { googleMessageToEmail, parseGoogleMailboxId } from '@/lib/google/gmail-mapper';
import type { Email } from '@/lib/jmap/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const rawMailboxId = url.searchParams.get('mailboxId');
  const query = url.searchParams.get('q') || undefined;
  const pageToken = url.searchParams.get('pageToken') || undefined;
  const maxResults = Math.min(parseInt(url.searchParams.get('maxResults') || '25', 10), 50);

  let googleAccountId =
    url.searchParams.get('googleAccountId') ||
    request.headers.get('x-google-account-id') ||
    undefined;

  let labelId: string | undefined = undefined;

  if (rawMailboxId) {
    const parsed = parseGoogleMailboxId(rawMailboxId);
    if (parsed) {
      googleAccountId = googleAccountId || parsed.accountEmail;
      labelId = parsed.labelId;
    } else {
      labelId = rawMailboxId;
    }
  }

  const session = await getGoogleSession(request, {
    accountId: googleAccountId,
    app: 'gmail',
  });

  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const accountEmail = session.tokens.email || session.account?.email || 'google';
    const labelIds = labelId && labelId !== 'ALL' ? [labelId] : undefined;

    const listRes = await listGmailMessages(session.accessToken, {
      labelIds,
      q: query,
      pageToken,
      maxResults,
    });

    const msgRefs = listRes.messages || [];

    // Fetch full messages in parallel (capped at maxResults)
    const emails: Email[] = await Promise.all(
      msgRefs.map(async (ref) => {
        try {
          const detail = await getGmailMessage(session.accessToken, ref.id, 'full');
          return googleMessageToEmail(detail, accountEmail);
        } catch (err) {
          logger.warn('Failed to fetch message details for ref', { id: ref.id, err });
          return null as unknown as Email;
        }
      })
    ).then((items) => items.filter(Boolean));

    const response = NextResponse.json({
      emails,
      nextPageToken: listRes.nextPageToken,
      total: listRes.resultSizeEstimate,
    });

    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Failed to list Gmail messages', { err });
    return NextResponse.json({ error: 'google_api_error' }, { status: 502 });
  }
}
