import { NextRequest, NextResponse } from 'next/server';
import { getValidMicrosoftAccounts, setMicrosoftSessionCookie } from '@/lib/microsoft/session';
import { mapMicrosoftToJmapTaskList } from '@/lib/microsoft/tasks-mapper';
import { MICROSOFT_GRAPH_BASE } from '@/lib/microsoft/auth';
import {
  MicrosoftGraphTodoList,
  isMicrosoftAppEnabled,
  resolveMicrosoftAppMode,
  MicrosoftAppMode,
} from '@/lib/microsoft/types';
import type { TaskList } from '@/stores/tasks-app-store';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const enabledAccounts = accounts.filter((a) => isMicrosoftAppEnabled(a.apps?.tasks));
  if (enabledAccounts.length === 0) {
    const res = NextResponse.json({ taskLists: [], accounts: [] });
    if (updatedSession) setMicrosoftSessionCookie(res, updatedSession);
    return res;
  }

  const allTaskLists: TaskList[] = [];
  const accountGroups: Array<{ email: string; mode: MicrosoftAppMode; taskLists: TaskList[] }> = [];

  for (const account of enabledAccounts) {
    try {
      const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/todo/lists`, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });

      if (!res.ok) {
        logger.error('Failed to fetch Microsoft task lists for account', {
          email: account.email,
          status: res.status,
        });
        continue;
      }

      const data = await res.json();
      const items: MicrosoftGraphTodoList[] = data.value || [];
      const mapped = items.map((item, idx) => mapMicrosoftToJmapTaskList(item, account.email, idx));
      allTaskLists.push(...mapped);
      accountGroups.push({
        email: account.email,
        mode: resolveMicrosoftAppMode(account.apps?.tasks),
        taskLists: mapped,
      });
    } catch (err) {
      logger.error('Exception fetching Microsoft task lists', { email: account.email, error: err });
    }
  }

  const response = NextResponse.json({ taskLists: allTaskLists, accounts: accountGroups });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}

export async function POST(request: NextRequest) {
  let body: { title: string; accountEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const { accounts, updatedSession } = await getValidMicrosoftAccounts(request);
  const enabledAccounts = accounts.filter((a) => isMicrosoftAppEnabled(a.apps?.tasks));
  const account = body.accountEmail
    ? enabledAccounts.find((a) => a.email.toLowerCase() === body.accountEmail!.toLowerCase())
    : enabledAccounts[0];

  if (!account) {
    return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
  }

  const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/todo/lists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName: body.title.trim() }),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Failed to create Microsoft task list', { status: res.status, error: errText });
    return NextResponse.json(
      { error: 'Failed to create Microsoft task list' },
      { status: res.status }
    );
  }

  const created: MicrosoftGraphTodoList = await res.json();
  const taskList = mapMicrosoftToJmapTaskList(created, account.email, 99);

  const response = NextResponse.json({ taskList });
  if (updatedSession) {
    setMicrosoftSessionCookie(response, updatedSession);
  }
  return response;
}
