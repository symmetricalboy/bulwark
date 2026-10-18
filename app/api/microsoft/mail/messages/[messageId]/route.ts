import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import {
  fetchOutlookMessage,
  updateOutlookMessage,
  moveOutlookMessage,
  deleteOutlookMessage,
} from '@/lib/microsoft/outlook-api';
import { mapOutlookMessageToEmail } from '@/lib/microsoft/outlook-mapper';
import { logger } from '@/lib/logger';

function parseNamespacedMessageId(rawId: string): { accountEmail: string; messageId: string } | null {
  const decoded = decodeURIComponent(rawId);
  if (!decoded.startsWith('microsoft:')) return null;
  const rest = decoded.slice('microsoft:'.length);
  const sepIdx = rest.indexOf('::');
  if (sepIdx < 0) return null;
  return {
    accountEmail: rest.slice(0, sepIdx),
    messageId: rest.slice(sepIdx + 2),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await context.params;
  const parsed = parseNamespacedMessageId(messageId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Microsoft message ID' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const acc = accounts.find(
    (a) => a.email.toLowerCase() === parsed.accountEmail.toLowerCase() && a.apps?.outlook === true
  );

  if (!acc) {
    return NextResponse.json({ error: 'Outlook account not found' }, { status: 404 });
  }

  try {
    const msg = await fetchOutlookMessage(acc.accessToken, parsed.messageId);
    const email = mapOutlookMessageToEmail(acc.email, msg);
    const response = NextResponse.json({ email });
    if (updatedSession) setMicrosoftSessionCookie(response, updatedSession);
    return response;
  } catch (err) {
    logger.error('Failed to fetch Outlook message detail', {
      email: acc.email,
      messageId: parsed.messageId,
      error: err,
    });
    return NextResponse.json({ error: 'Failed to fetch Outlook message' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await context.params;
  const parsed = parseNamespacedMessageId(messageId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Microsoft message ID' }, { status: 400 });
  }

  let body: {
    markRead?: boolean;
    flagged?: boolean;
    trash?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const acc = accounts.find(
    (a) => a.email.toLowerCase() === parsed.accountEmail.toLowerCase() && a.apps?.outlook === true
  );

  if (!acc) {
    return NextResponse.json({ error: 'Outlook account not found' }, { status: 404 });
  }

  try {
    let updatedMsg;
    if (body.trash) {
      updatedMsg = await moveOutlookMessage(acc.accessToken, parsed.messageId, 'deleteditems');
    } else {
      updatedMsg = await updateOutlookMessage(acc.accessToken, parsed.messageId, {
        isRead: body.markRead,
        flagged: body.flagged,
      });
    }

    const email = mapOutlookMessageToEmail(acc.email, updatedMsg);
    const response = NextResponse.json({ email });
    if (updatedSession) setMicrosoftSessionCookie(response, updatedSession);
    return response;
  } catch (err) {
    logger.error('Failed to update Outlook message', {
      email: acc.email,
      messageId: parsed.messageId,
      error: err,
    });
    return NextResponse.json({ error: 'Failed to update Outlook message' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await context.params;
  const parsed = parseNamespacedMessageId(messageId);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Microsoft message ID' }, { status: 400 });
  }

  const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const acc = accounts.find(
    (a) => a.email.toLowerCase() === parsed.accountEmail.toLowerCase() && a.apps?.outlook === true
  );

  if (!acc) {
    return NextResponse.json({ error: 'Outlook account not found' }, { status: 404 });
  }

  try {
    if (permanent) {
      await deleteOutlookMessage(acc.accessToken, parsed.messageId);
    } else {
      await moveOutlookMessage(acc.accessToken, parsed.messageId, 'deleteditems');
    }
    const response = NextResponse.json({ success: true });
    if (updatedSession) setMicrosoftSessionCookie(response, updatedSession);
    return response;
  } catch (err) {
    logger.error('Failed to delete/trash Outlook message', {
      email: acc.email,
      messageId: parsed.messageId,
      error: err,
    });
    return NextResponse.json({ error: 'Failed to delete Outlook message' }, { status: 500 });
  }
}
