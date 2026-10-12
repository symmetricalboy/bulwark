import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import {
  getGmailMessage,
  modifyGmailMessage,
  trashGmailMessage,
  untrashGmailMessage,
  deleteGmailMessage,
} from '@/lib/google/gmail-api';
import { googleMessageToEmail, parseGoogleEmailId } from '@/lib/google/gmail-mapper';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ messageId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { messageId: rawId } = await context.params;
  const decodedId = decodeURIComponent(rawId);

  let googleAccountId =
    request.nextUrl.searchParams.get('googleAccountId') ||
    request.headers.get('x-google-account-id') ||
    undefined;

  let actualMessageId = decodedId;
  const parsed = parseGoogleEmailId(decodedId);
  if (parsed) {
    googleAccountId = googleAccountId || parsed.accountEmail;
    actualMessageId = parsed.messageId;
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
    const detail = await getGmailMessage(session.accessToken, actualMessageId, 'full');
    const email = googleMessageToEmail(detail, accountEmail);

    const response = NextResponse.json({ email });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Failed to get Gmail message', { actualMessageId, err });
    return NextResponse.json({ error: 'google_api_error' }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { messageId: rawId } = await context.params;
  const decodedId = decodeURIComponent(rawId);

  let googleAccountId =
    request.nextUrl.searchParams.get('googleAccountId') ||
    request.headers.get('x-google-account-id') ||
    undefined;

  let actualMessageId = decodedId;
  const parsed = parseGoogleEmailId(decodedId);
  if (parsed) {
    googleAccountId = googleAccountId || parsed.accountEmail;
    actualMessageId = parsed.messageId;
  }

  const session = await getGoogleSession(request, {
    accountId: googleAccountId,
    app: 'gmail',
  });

  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      read?: boolean;
      starred?: boolean;
      action?: 'trash' | 'untrash';
      addLabelIds?: string[];
      removeLabelIds?: string[];
    };

    const addLabels: string[] = [...(body.addLabelIds || [])];
    const removeLabels: string[] = [...(body.removeLabelIds || [])];

    if (body.action === 'trash') {
      await trashGmailMessage(session.accessToken, actualMessageId);
      const response = NextResponse.json({ success: true, action: 'trash' });
      attachRefreshedTokens(response, session.refreshedTokens);
      return response;
    }

    if (body.action === 'untrash') {
      await untrashGmailMessage(session.accessToken, actualMessageId);
      const response = NextResponse.json({ success: true, action: 'untrash' });
      attachRefreshedTokens(response, session.refreshedTokens);
      return response;
    }

    if (body.read === true) {
      removeLabels.push('UNREAD');
    } else if (body.read === false) {
      addLabels.push('UNREAD');
    }

    if (body.starred === true) {
      addLabels.push('STARRED');
    } else if (body.starred === false) {
      removeLabels.push('STARRED');
    }

    const updated = await modifyGmailMessage(
      session.accessToken,
      actualMessageId,
      addLabels,
      removeLabels
    );

    const accountEmail = session.tokens.email || session.account?.email || 'google';
    const email = googleMessageToEmail(updated, accountEmail);

    const response = NextResponse.json({ email });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Failed to update Gmail message', { actualMessageId, err });
    return NextResponse.json({ error: 'google_api_error' }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { messageId: rawId } = await context.params;
  const decodedId = decodeURIComponent(rawId);
  const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

  let googleAccountId =
    request.nextUrl.searchParams.get('googleAccountId') ||
    request.headers.get('x-google-account-id') ||
    undefined;

  let actualMessageId = decodedId;
  const parsed = parseGoogleEmailId(decodedId);
  if (parsed) {
    googleAccountId = googleAccountId || parsed.accountEmail;
    actualMessageId = parsed.messageId;
  }

  const session = await getGoogleSession(request, {
    accountId: googleAccountId,
    app: 'gmail',
  });

  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    if (permanent) {
      await deleteGmailMessage(session.accessToken, actualMessageId);
    } else {
      await trashGmailMessage(session.accessToken, actualMessageId);
    }

    const response = NextResponse.json({ success: true });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Failed to delete Gmail message', { actualMessageId, permanent, err });
    return NextResponse.json({ error: 'google_api_error' }, { status: 502 });
  }
}
