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
  const maxResults = Math.min(Math.max(1, parseInt(url.searchParams.get('maxResults') || '50', 10)), 100);

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
    let labelIds: string[] | undefined = undefined;
    let q = query;

    const upperLabel = labelId?.toUpperCase();
    if (labelId?.startsWith('star:')) {
      const starId = labelId.slice('star:'.length);
      const starFilter = `has:${starId}`;
      q = q ? `${q} ${starFilter}` : starFilter;
      labelIds = undefined;
    } else if (upperLabel === 'ARCHIVE') {
      const archiveFilter = '-in:inbox -in:sent -in:spam -in:trash -in:draft';
      q = q ? `${q} ${archiveFilter}` : archiveFilter;
      labelIds = undefined;
    } else if (upperLabel === 'ALL' || upperLabel === 'ALL_MAIL') {
      labelIds = undefined;
    } else if (upperLabel === 'UNREAD') {
      labelIds = ['UNREAD'];
    } else if (labelId) {
      labelIds = [labelId];
    }

    const listRes = await listGmailMessages(session.accessToken, {
      labelIds,
      q,
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
