import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { listOutlookMessages } from '@/lib/microsoft/outlook-api';
import { mapOutlookMessageToEmail } from '@/lib/microsoft/outlook-mapper';
import { logger } from '@/lib/logger';

function parseMicrosoftMailboxId(mailboxId: string): { accountEmail: string; folderId: string } | null {
  if (!mailboxId.startsWith('microsoft:')) return null;
  const rest = mailboxId.slice('microsoft:'.length);
  const sepIdx = rest.indexOf('::');
  if (sepIdx < 0) return null;
  return {
    accountEmail: rest.slice(0, sepIdx),
    folderId: rest.slice(sepIdx + 2),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mailboxId = searchParams.get('mailboxId') || '';
  const accountEmailParam = searchParams.get('accountEmail') || '';
  const query = searchParams.get('q') || '';
  const pageToken = searchParams.get('pageToken') || '';
  const maxResults = Math.min(Number(searchParams.get('maxResults') || 30), 50);

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const outlookAccounts = accounts.filter((a) => a.apps?.outlook === true);

  let targetEmail = accountEmailParam;
  let folderId = 'ALL_MAIL';

  if (mailboxId) {
    const parsed = parseMicrosoftMailboxId(mailboxId);
    if (parsed) {
      targetEmail = parsed.accountEmail;
      folderId = parsed.folderId;
    }
  }

  const acc = targetEmail
    ? outlookAccounts.find((a) => a.email.toLowerCase() === targetEmail.toLowerCase())
    : outlookAccounts[0];

  if (!acc) {
    const res = NextResponse.json({ emails: [], nextPageToken: undefined, total: 0 });
    if (updatedSession) setMicrosoftSessionCookie(res, updatedSession);
    return res;
  }

  try {
    const skip = pageToken ? parseInt(pageToken, 10) || 0 : 0;
    let filter: string | undefined;
    let effectiveFolderId: string | undefined = folderId;

    if (folderId === 'FLAGGED') {
      effectiveFolderId = 'ALL_MAIL';
      filter = "flag/flagStatus eq 'flagged'";
    } else if (folderId === 'ALL_MAIL') {
      effectiveFolderId = 'ALL_MAIL';
    }

    const listResult = await listOutlookMessages(acc.accessToken, {
      folderId: effectiveFolderId,
      query: query || undefined,
      filter,
      top: maxResults,
      skip,
    });

    const emails = listResult.messages.map((msg) => mapOutlookMessageToEmail(acc.email, msg));
    const response = NextResponse.json({
      emails,
      nextPageToken: listResult.nextSkip !== undefined ? String(listResult.nextSkip) : undefined,
      total: listResult.totalEstimate || emails.length,
    });

    if (updatedSession) {
      setMicrosoftSessionCookie(response, updatedSession);
    }
    return response;
  } catch (err) {
    logger.error('Failed to list Outlook messages', { email: acc.email, folderId, error: err });
    return NextResponse.json({ error: 'Failed to list Outlook messages' }, { status: 500 });
  }
}
