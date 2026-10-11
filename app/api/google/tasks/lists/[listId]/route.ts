import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const { listId } = await params;
  if (!listId) {
    return NextResponse.json({ error: 'list_id_required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { title } = body;
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title_required' }, { status: 400 });
    }

    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/${encodeURIComponent(listId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: title.trim() }),
    });

    if (!res.ok) {
      logger.error('Failed to update Google task list', { status: res.status, listId });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const taskList = await res.json();
    const response = NextResponse.json({ taskList });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception updating Google task list', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const { listId } = await params;
  if (!listId) {
    return NextResponse.json({ error: 'list_id_required' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/${encodeURIComponent(listId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!res.ok && res.status !== 204) {
      logger.error('Failed to delete Google task list', { status: res.status, listId });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const response = NextResponse.json({ success: true });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception deleting Google task list', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
