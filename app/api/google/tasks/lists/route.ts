import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import type { GoogleTaskListsResponse } from '@/lib/google/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getGoogleSession(request);
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
    const taskLists = data.items || [];

    const response = NextResponse.json({ taskLists });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception fetching Google task lists', { err });
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
    const { title } = body;
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title_required' }, { status: 400 });
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

    const taskList = await res.json();
    const response = NextResponse.json({ taskList });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception creating Google task list', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
