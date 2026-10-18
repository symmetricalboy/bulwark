import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { mapMicrosoftToJmapTaskList } from '@/lib/microsoft/tasks-mapper';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import { MicrosoftGraphTodoList, isMicrosoftAppEnabled } from '@/lib/microsoft/types';
import { logger } from '@/lib/logger';

function parseNamespacedId(namespacedId: string): { email: string; rawId: string } | null {
  if (!namespacedId.startsWith('microsoft:')) return null;
  const withoutPrefix = namespacedId.slice('microsoft:'.length);
  const sepIdx = withoutPrefix.indexOf('::');
  if (sepIdx === -1) return null;
  return {
    email: withoutPrefix.slice(0, sepIdx),
    rawId: withoutPrefix.slice(sepIdx + 2),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  const parsed = parseNamespacedId(decodeURIComponent(listId));
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Microsoft taskListId' }, { status: 400 });
  }

  let body: { title: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const account = accounts.find(
    (a) =>
      a.email.toLowerCase() === parsed.email.toLowerCase() &&
      isMicrosoftAppEnabled(a.apps?.tasks)
  );
  if (!account) {
    return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
  }

  const res = await fetch(
    `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(parsed.rawId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName: body.title }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Failed to update Microsoft task list', { status: res.status, error: errText });
    return NextResponse.json(
      { error: 'Failed to update Microsoft task list' },
      { status: res.status }
    );
  }

  const updated: MicrosoftGraphTodoList = await res.json();
  const taskList = mapMicrosoftToJmapTaskList(updated, account.email);

  const response = NextResponse.json({ taskList });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  const parsed = parseNamespacedId(decodeURIComponent(listId));
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Microsoft taskListId' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const account = accounts.find(
    (a) =>
      a.email.toLowerCase() === parsed.email.toLowerCase() &&
      isMicrosoftAppEnabled(a.apps?.tasks)
  );
  if (!account) {
    return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
  }

  const res = await fetch(
    `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(parsed.rawId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
    }
  );

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    logger.error('Failed to delete Microsoft task list', { status: res.status, error: errText });
    return NextResponse.json(
      { error: 'Failed to delete Microsoft task list' },
      { status: res.status }
    );
  }

  const response = NextResponse.json({ success: true });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}
