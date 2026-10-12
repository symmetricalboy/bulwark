import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, getAllGoogleSessions, attachRefreshedTokens } from '@/lib/google/session';
import { getGmailLabels } from '@/lib/google/gmail-api';
import { googleLabelToMailbox } from '@/lib/google/gmail-mapper';
import type { Mailbox } from '@/lib/jmap/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const specificAccountId =
    request.nextUrl.searchParams.get('googleAccountId') ||
    request.headers.get('x-google-account-id');

  if (specificAccountId) {
    const session = await getGoogleSession(request, { accountId: specificAccountId, app: 'gmail' });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }

    try {
      const labels = await getGmailLabels(session.accessToken);
      const accountEmail = session.tokens.email || session.account?.email || 'google';
      const mailboxes = labels.map((lbl) => googleLabelToMailbox(lbl, accountEmail));

      mailboxes.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return (a.name || '').localeCompare(b.name || '');
      });

      const response = NextResponse.json({ mailboxes });
      attachRefreshedTokens(response, session.refreshedTokens);
      return response;
    } catch (err) {
      logger.error('Exception fetching Google mail labels', { err });
      return NextResponse.json({ error: 'google_api_error' }, { status: 502 });
    }
  }

  // Multi-account: fetch across all connected Google accounts with gmail enabled
  const multiSessions = await getAllGoogleSessions(request, { app: 'gmail' });
  if (!multiSessions || multiSessions.sessions.length === 0) {
    const single = await getGoogleSession(request, { app: 'gmail' });
    if (!single) {
      return NextResponse.json({ mailboxes: [] });
    }
    try {
      const labels = await getGmailLabels(single.accessToken);
      const accountEmail = single.tokens.email || single.account?.email || 'google';
      const mailboxes = labels.map((lbl) => googleLabelToMailbox(lbl, accountEmail));

      mailboxes.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return (a.name || '').localeCompare(b.name || '');
      });

      const response = NextResponse.json({ mailboxes });
      attachRefreshedTokens(response, single.refreshedTokens);
      return response;
    } catch (err) {
      logger.error('Failed to list Google mail labels', { err });
      return NextResponse.json({ error: 'google_api_error' }, { status: 502 });
    }
  }

  try {
    const allMailboxes: Mailbox[] = [];
    for (const session of multiSessions.sessions) {
      try {
        const labels = await getGmailLabels(session.accessToken);
        const accountEmail = session.tokens.email || session.account?.email || 'google';
        const mailboxes = labels.map((lbl) => googleLabelToMailbox(lbl, accountEmail));
        allMailboxes.push(...mailboxes);
      } catch (err) {
        logger.warn('Failed to fetch labels for Google account', { email: session.account?.email, err });
      }
    }

    allMailboxes.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return (a.name || '').localeCompare(b.name || '');
    });

    const response = NextResponse.json({ mailboxes: allMailboxes });
    if (multiSessions.refreshedSessionData) {
      attachRefreshedTokens(response, multiSessions.refreshedSessionData);
    }
    return response;
  } catch (err) {
    logger.error('Failed to list multi-account Google mail labels', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
