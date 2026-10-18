import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { fetchOutlookFolders, createOutlookFolder } from '@/lib/microsoft/outlook-api';
import { mapOutlookFolderToMailbox, buildVirtualOutlookMailboxes } from '@/lib/microsoft/outlook-mapper';
import type { Mailbox } from '@/lib/jmap/types';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const outlookAccounts = accounts.filter((a) => a.apps?.outlook === true);

  if (outlookAccounts.length === 0) {
    const res = NextResponse.json({ mailboxes: [], accounts: [] });
    if (updatedSession) setMicrosoftSessionCookie(res, updatedSession);
    return res;
  }

  const allMailboxes: Mailbox[] = [];
  const accountInfos: Array<{ id: string; email: string; name?: string }> = [];

  for (const acc of outlookAccounts) {
    accountInfos.push({ id: `microsoft:${acc.email}`, email: acc.email, name: acc.name });
    try {
      const folders = await fetchOutlookFolders(acc.accessToken);
      const mapped = folders
        .map((f, idx) => mapOutlookFolderToMailbox(acc.email, f, idx))
        .filter((m): m is Mailbox => m !== null);
      const virtual = buildVirtualOutlookMailboxes(acc.email);
      const merged = [...mapped, ...virtual].sort((a, b) => a.sortOrder - b.sortOrder);
      allMailboxes.push(...merged);
    } catch (err) {
      logger.error('Failed to fetch Outlook folders for account', { email: acc.email, error: err });
    }
  }

  const response = NextResponse.json({
    mailboxes: allMailboxes,
    accounts: accountInfos,
  });

  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }

  return response;
}

export async function POST(request: NextRequest) {
  let body: { accountEmail?: string; name?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { accountEmail, name } = body;
  if (!accountEmail || !name?.trim()) {
    return NextResponse.json({ error: 'Missing accountEmail or folder name' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const acc = accounts.find(
    (a) => a.email.toLowerCase() === accountEmail.toLowerCase() && a.apps?.outlook === true
  );

  if (!acc) {
    return NextResponse.json({ error: 'Outlook account not found or disabled' }, { status: 404 });
  }

  try {
    const created = await createOutlookFolder(acc.accessToken, name.trim());
    const mailbox = mapOutlookFolderToMailbox(acc.email, created, 200);
    const response = NextResponse.json({ mailbox });
    if (updatedSession) setMicrosoftSessionCookie(response, updatedSession);
    return response;
  } catch (err) {
    logger.error('Failed to create Outlook folder', { email: acc.email, name, error: err });
    return NextResponse.json({ error: 'Failed to create Outlook folder' }, { status: 500 });
  }
}
