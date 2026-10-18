import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import { isMicrosoftAppEnabled, MicrosoftGraphTodoTask } from '@/lib/microsoft/types';
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

export async function POST(request: NextRequest) {
  let body: { taskListId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = parseNamespacedId(body.taskListId || '');
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

  // List completed tasks and delete them
  const listRes = await fetch(
    `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(parsed.rawId)}/tasks?$filter=status eq 'completed'&$select=id`,
    {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    logger.error('Failed to list completed Microsoft tasks', { status: listRes.status, error: errText });
    return NextResponse.json(
      { error: 'Failed to clear completed Microsoft tasks' },
      { status: listRes.status }
    );
  }

  const data = await listRes.json();
  const completedTasks: MicrosoftGraphTodoTask[] = data.value || [];

  await Promise.all(
    completedTasks.map((t) =>
      fetch(
        `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(parsed.rawId)}/tasks/${encodeURIComponent(t.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${account.accessToken}` },
        }
      )
    )
  );

  const response = NextResponse.json({ success: true });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}
