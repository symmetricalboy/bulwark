import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, getAllGoogleSessions, attachRefreshedTokens } from '@/lib/google/session';
import type { GoogleTaskListsResponse } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const requestedAccountId = searchParams.get('googleAccountId');

  if (requestedAccountId) {
    const session = await getGoogleSession(request, { accountId: requestedAccountId, app: 'tasks' });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }
    try {
      const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) {
        logger.error('Failed to list Google task lists', { status: res.status });
        return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
      }
      const data = (await res.json()) as GoogleTaskListsResponse;
      const accountEmail = session.tokens.email || 'google';
      const taskLists = (data.items || []).map((list) => ({
        ...list,
        id: `google:${accountEmail}::${list.id}`,
        originalId: list.id,
        accountEmail,
        localAccountId: `google:${accountEmail}`,
      }));
      const response = NextResponse.json({ taskLists });
      attachRefreshedTokens(response, session.refreshedTokens);
      return response;
    } catch (err) {
      logger.error('Exception fetching Google task lists', { err });
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
  }

  const allSessions = await getAllGoogleSessions(request, { app: 'tasks' });
  if (!allSessions || allSessions.sessions.length === 0) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const allLists = (
      await Promise.all(
        allSessions.sessions.map(async (sess) => {
          try {
            const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100', {
              headers: { Authorization: `Bearer ${sess.accessToken}` },
            });
            if (!res.ok) return [];
            const data = (await res.json()) as GoogleTaskListsResponse;
            const accountEmail = sess.tokens.email || sess.account?.email || 'google';
            return (data.items || []).map((list) => ({
              ...list,
              id: `google:${accountEmail}::${list.id}`,
              originalId: list.id,
              accountEmail,
              localAccountId: `google:${accountEmail}`,
            }));
          } catch (err) {
            logger.warn('Failed to fetch task lists for session in getAllGoogleSessions', { err });
            return [];
          }
        })
      )
    ).flat();

    const response = NextResponse.json({ taskLists: allLists });
    attachRefreshedTokens(response, allSessions);
    return response;
  } catch (err) {
    logger.error('Exception fetching all Google task lists', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, accountId, googleAccountId } = body;
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title_required' }, { status: 400 });
    }

    const session = await getGoogleSession(request, {
      accountId: accountId || googleAccountId,
      app: 'tasks',
    });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }

    const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: title.trim() }),
    });

    if (!res.ok) {
      logger.error('Failed to create Google task list', { status: res.status });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const created = await res.json();
    const accountEmail = session.tokens.email || 'google';
    const taskList = {
      ...created,
      id: `google:${accountEmail}::${created.id}`,
      originalId: created.id,
      accountEmail,
      localAccountId: `google:${accountEmail}`,
    };

    const response = NextResponse.json({ taskList });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception creating Google task list', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
