import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: 'task_id_required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { listId = '@default', updates } = body;

    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Failed to update Google task', { status: res.status, taskId, errText });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const updatedTask = await res.json();
    const response = NextResponse.json({ task: updatedTask });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception updating Google task', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await getGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: 'task_id_required' }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const listId = searchParams.get('listId') || '@default';

  try {
    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    );

    if (!res.ok && res.status !== 204) {
      logger.error('Failed to delete Google task', { status: res.status, taskId, listId });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const response = NextResponse.json({ success: true });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception deleting Google task', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
