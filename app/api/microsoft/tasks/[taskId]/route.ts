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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const parsedTask = parseNamespacedId(decodeURIComponent(taskId));

  let body: { taskListId: string; updates: Partial<TaskItem> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsedList = parseNamespacedId(body.taskListId);
  if (!parsedTask || !parsedList) {
    return NextResponse.json({ error: 'Invalid Microsoft IDs' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const account = accounts.find(
    (a) =>
      a.email.toLowerCase() === parsedList.email.toLowerCase() &&
      isMicrosoftAppEnabled(a.apps?.tasks)
  );
  if (!account) {
    return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
  }

  const msPayload = mapJmapToMicrosoftTask(body.updates);
  const url = `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(parsedList.rawId)}/tasks/${encodeURIComponent(parsedTask.rawId)}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(msPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Failed to update Microsoft task', { status: res.status, error: errText });
    return NextResponse.json({ error: 'Failed to update Microsoft task' }, { status: res.status });
  }

  const updated: MicrosoftGraphTodoTask = await res.json();
  const task = mapMicrosoftToJmapTask(updated, body.taskListId, account.email);

  const response = NextResponse.json({ task });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const parsedTask = parseNamespacedId(decodeURIComponent(taskId));
  const taskListId = request.nextUrl.searchParams.get('taskListId') || '';
  const parsedList = parseNamespacedId(taskListId);

  if (!parsedTask || !parsedList) {
    return NextResponse.json({ error: 'Invalid Microsoft IDs' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const account = accounts.find(
    (a) =>
      a.email.toLowerCase() === parsedList.email.toLowerCase() &&
      isMicrosoftAppEnabled(a.apps?.tasks)
  );
  if (!account) {
    return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
  }

  const url = `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(parsedList.rawId)}/tasks/${encodeURIComponent(parsedTask.rawId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    logger.error('Failed to delete Microsoft task', { status: res.status, error: errText });
    return NextResponse.json({ error: 'Failed to delete Microsoft task' }, { status: res.status });
  }

  const response = NextResponse.json({ success: true });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}
