import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import type { GoogleTasksResponse, GoogleTaskListsResponse } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const listId = searchParams.get('listId');
  const all = searchParams.get('all') === 'true';
  const showCompleted = searchParams.get('showCompleted') !== 'false';

  try {
    if (all) {
      // Fetch lists first, then tasks for each list
      const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });

      if (!listsRes.ok) {
        logger.error('Failed to fetch Google task lists during all fetch', { status: listsRes.status });
        return NextResponse.json({ error: 'google_api_error', status: listsRes.status }, { status: 502 });
      }

      const listsData = (await listsRes.json()) as GoogleTaskListsResponse;
      const lists = listsData.items || [];

      const tasksByList = await Promise.all(
        lists.map(async (l) => {
          try {
            const query = new URLSearchParams({
              showCompleted: 'true',
              showHidden: 'true',
              maxResults: '100',
            });
            const tRes = await fetch(
              `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(l.id)}/tasks?${query.toString()}`,
              { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            if (!tRes.ok) return { listId: l.id, listTitle: l.title, tasks: [] };
            const tData = (await tRes.json()) as GoogleTasksResponse;
            return { listId: l.id, listTitle: l.title, tasks: tData.items || [] };
          } catch {
            return { listId: l.id, listTitle: l.title, tasks: [] };
          }
        })
      );

      const response = NextResponse.json({ tasksByList });
      attachRefreshedTokens(response, session.refreshedTokens);
      return response;
    }

    const targetListId = listId || '@default';
    const query = new URLSearchParams({
      showCompleted: showCompleted ? 'true' : 'false',
      showHidden: 'true',
      maxResults: '100',
    });

    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(targetListId)}/tasks?${query.toString()}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    if (!res.ok) {
      logger.error('Failed to list Google tasks', { status: res.status, listId: targetListId });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const data = (await res.json()) as GoogleTasksResponse;
    const tasks = data.items || [];

    const response = NextResponse.json({ tasks });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception fetching Google tasks', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { listId = '@default', task, parent } = body;

    if (!task || !task.title) {
      return NextResponse.json({ error: 'title_required' }, { status: 400 });
    }

    const query = new URLSearchParams();
    if (parent) query.set('parent', parent);

    const qStr = query.toString();
    const url = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks${qStr ? `?${qStr}` : ''}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Failed to create Google task', { status: res.status, errText });
      return NextResponse.json({ error: 'google_api_error', status: res.status, details: errText }, { status: 502 });
    }

    const createdTask = await res.json();
    const response = NextResponse.json({ task: createdTask });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception creating Google task', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
