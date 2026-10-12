import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, getAllGoogleSessions, attachRefreshedTokens } from '@/lib/google/session';
import type { GoogleTasksResponse, GoogleTaskListsResponse, GoogleTask } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function cleanId(id: string): string {
  const parts = id.split('::');
  return parts.length > 1 ? parts[1] : id;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const listId = searchParams.get('listId');
  const all = searchParams.get('all') === 'true';
  const showCompleted = searchParams.get('showCompleted') !== 'false';
  const requestedAccountId = searchParams.get('googleAccountId');

  try {
    if (all) {
      if (requestedAccountId) {
        const session = await getGoogleSession(request, { accountId: requestedAccountId, app: 'tasks' });
        if (!session) {
          return NextResponse.json({ error: 'not_connected' }, { status: 401 });
        }
        const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100', {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        if (!listsRes.ok) {
          logger.error('Failed to fetch Google task lists', { status: listsRes.status });
          return NextResponse.json({ error: 'google_api_error', status: listsRes.status }, { status: 502 });
        }
        const listsData = (await listsRes.json()) as GoogleTaskListsResponse;
        const lists = listsData.items || [];
        const accountEmail = session.tokens.email || 'google';

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
              if (!tRes.ok) return { listId: `google:${accountEmail}::${l.id}`, listTitle: l.title, accountEmail, tasks: [] };
              const tData = (await tRes.json()) as GoogleTasksResponse;
              const mappedTasks = (tData.items || []).map((t) => ({
                ...t,
                id: `google:${accountEmail}::${t.id}`,
                originalId: t.id,
                listId: `google:${accountEmail}::${l.id}`,
                accountEmail,
                localAccountId: `google:${accountEmail}`,
              }));
              return {
                listId: `google:${accountEmail}::${l.id}`,
                originalId: l.id,
                listTitle: l.title,
                accountEmail,
                localAccountId: `google:${accountEmail}`,
                tasks: mappedTasks,
              };
            } catch {
              return { listId: `google:${accountEmail}::${l.id}`, listTitle: l.title, accountEmail, tasks: [] };
            }
          })
        );

        const response = NextResponse.json({ tasksByList });
        attachRefreshedTokens(response, session.refreshedTokens);
        return response;
      }

      const allSessions = await getAllGoogleSessions(request, { app: 'tasks' });
      if (!allSessions || allSessions.sessions.length === 0) {
        return NextResponse.json({ error: 'not_connected' }, { status: 401 });
      }

      const tasksByListArrays = await Promise.all(
        allSessions.sessions.map(async (sess) => {
          try {
            const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100', {
              headers: { Authorization: `Bearer ${sess.accessToken}` },
            });
            if (!listsRes.ok) return [];
            const listsData = (await listsRes.json()) as GoogleTaskListsResponse;
            const lists = listsData.items || [];
            const accountEmail = sess.tokens.email || sess.account?.email || 'google';

            return await Promise.all(
              lists.map(async (l) => {
                try {
                  const query = new URLSearchParams({
                    showCompleted: 'true',
                    showHidden: 'true',
                    maxResults: '100',
                  });
                  const tRes = await fetch(
                    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(l.id)}/tasks?${query.toString()}`,
                    { headers: { Authorization: `Bearer ${sess.accessToken}` } }
                  );
                  if (!tRes.ok) return { listId: `google:${accountEmail}::${l.id}`, listTitle: l.title, accountEmail, tasks: [] };
                  const tData = (await tRes.json()) as GoogleTasksResponse;
                  const mappedTasks = (tData.items || []).map((t) => ({
                    ...t,
                    id: `google:${accountEmail}::${t.id}`,
                    originalId: t.id,
                    listId: `google:${accountEmail}::${l.id}`,
                    accountEmail,
                    localAccountId: `google:${accountEmail}`,
                  }));
                  return {
                    listId: `google:${accountEmail}::${l.id}`,
                    originalId: l.id,
                    listTitle: l.title,
                    accountEmail,
                    localAccountId: `google:${accountEmail}`,
                    tasks: mappedTasks,
                  };
                } catch {
                  return { listId: `google:${accountEmail}::${l.id}`, listTitle: l.title, accountEmail, tasks: [] };
                }
              })
            );
          } catch {
            return [];
          }
        })
      );

      const tasksByList = tasksByListArrays.flat();
      const response = NextResponse.json({ tasksByList });
      attachRefreshedTokens(response, allSessions);
      return response;
    }

    const session = await getGoogleSession(request, {
      accountId: listId || requestedAccountId || undefined,
      app: 'tasks',
    });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }

    const rawListId = listId || '@default';
    const targetListId = cleanId(rawListId);
    const accountEmail = session.tokens.email || 'google';

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
    const tasks = (data.items || []).map((t) => ({
      ...t,
      id: `google:${accountEmail}::${t.id}`,
      originalId: t.id,
      listId: `google:${accountEmail}::${targetListId}`,
      accountEmail,
      localAccountId: `google:${accountEmail}`,
    }));

    const response = NextResponse.json({ tasks });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception fetching Google tasks', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listId = '@default', task, parent, googleAccountId } = body;

    if (!task || !task.title) {
      return NextResponse.json({ error: 'title_required' }, { status: 400 });
    }

    const session = await getGoogleSession(request, {
      accountId: listId.startsWith('google:') ? listId : googleAccountId,
      app: 'tasks',
    });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }

    const targetListId = cleanId(listId);
    const accountEmail = session.tokens.email || 'google';

    const query = new URLSearchParams();
    if (parent) query.set('parent', cleanId(parent));

    const qStr = query.toString();
    const url = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(targetListId)}/tasks${qStr ? `?${qStr}` : ''}`;

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

    const createdTask = (await res.json()) as GoogleTask;
    const mappedTask = {
      ...createdTask,
      id: `google:${accountEmail}::${createdTask.id}`,
      originalId: createdTask.id,
      listId: `google:${accountEmail}::${targetListId}`,
      accountEmail,
      localAccountId: `google:${accountEmail}`,
    };

    const response = NextResponse.json({ task: mappedTask });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception creating Google task', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
