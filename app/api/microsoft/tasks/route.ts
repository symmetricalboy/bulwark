import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { mapMicrosoftToJmapTask, mapJmapToMicrosoftTask } from '@/lib/microsoft/tasks-mapper';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import { MicrosoftGraphTodoTask, isMicrosoftAppEnabled } from '@/lib/microsoft/types';
import type { TaskItem } from '@/stores/tasks-app-store';
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

export async function GET(request: NextRequest) {
  const taskListId = request.nextUrl.searchParams.get('taskListId') || '';
  const parsed = parseNamespacedId(taskListId);
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

  const url = `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(parsed.rawId)}/tasks?$top=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${account.accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Failed to fetch Microsoft tasks', { status: res.status, error: errText });
    return NextResponse.json({ error: 'Failed to fetch Microsoft tasks' }, { status: res.status });
  }

  const data = await res.json();
  const items: MicrosoftGraphTodoTask[] = data.value || [];
  const tasks: TaskItem[] = items.map((item) =>
    mapMicrosoftToJmapTask(item, taskListId, account.email)
  );

  const response = NextResponse.json({ tasks });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}

export async function POST(request: NextRequest) {
  let body: { taskListId: string; task: Partial<TaskItem> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = parseNamespacedId(body.taskListId);
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

  const msPayload = mapJmapToMicrosoftTask(body.task);
  const url = `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(parsed.rawId)}/tasks`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(msPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Failed to create Microsoft task', { status: res.status, error: errText });
    return NextResponse.json({ error: 'Failed to create Microsoft task' }, { status: res.status });
  }

  const created: MicrosoftGraphTodoTask = await res.json();
  const task = mapMicrosoftToJmapTask(created, body.taskListId, account.email);

  const response = NextResponse.json({ task });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}
